// Package runtime drives preview containers on the host Docker daemon: a
// hardened `docker run`, per-preview networks, and the start/stop/remove
// lifecycle. Every preview runs with dropped capabilities, no-new-privileges,
// resource limits and an isolated network; the Docker socket is never mounted.
package runtime

import (
	"context"
	"fmt"
	"net"
	"sort"
	"strconv"
	"strings"

	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/model"
)

// RunSpec describes one hardened preview container to start.
type RunSpec struct {
	Name          string
	Image         string
	Network       string
	ContainerPort int
	HostPort      int // 127.0.0.1 host port; allocated if zero
	Env           map[string]string
	Secrets       map[string]string // injected at runtime, never baked
	Limits        config.PerPreview
	ReadOnlyRoot  bool
	Labels        map[string]string
}

// Runtime is the container lifecycle interface the reconciler depends on.
type Runtime interface {
	EnsureNetwork(ctx context.Context, name string) error
	RemoveNetwork(ctx context.Context, name string) error
	Run(ctx context.Context, spec RunSpec) (containerID string, hostPort int, err error)
	Start(ctx context.Context, containerID string) error
	Stop(ctx context.Context, containerID string) error
	Remove(ctx context.Context, containerID string) error
	RemoveImage(ctx context.Context, image string) error
	ListManaged(ctx context.Context) ([]Container, error)
	PruneDangling(ctx context.Context) error
}

// Container is a managed container as reported by `docker ps`.
type Container struct {
	ID    string
	Name  string
	Repo  string
	PR    int
	App   string
	State string
}

// DockerRuntime implements Runtime by shelling out to the docker CLI.
type DockerRuntime struct {
	r runner
}

// New returns a DockerRuntime backed by the real docker CLI.
func New() *DockerRuntime { return &DockerRuntime{r: execRunner{}} }

// EnsureNetwork creates an isolated bridge network if it does not exist.
func (d *DockerRuntime) EnsureNetwork(ctx context.Context, name string) error {
	if _, _, err := d.r.run(ctx, "docker", "network", "inspect", name); err == nil {
		return nil
	}
	_, _, err := d.r.run(ctx, "docker", "network", "create", "--driver", "bridge", name)
	if err != nil {
		return fmt.Errorf("create network %s: %w", name, err)
	}
	return nil
}

// RemoveNetwork deletes a per-preview network (ignoring "not found").
func (d *DockerRuntime) RemoveNetwork(ctx context.Context, name string) error {
	_, _, err := d.r.run(ctx, "docker", "network", "rm", name)
	if err != nil && !isNotFound(err) {
		return err
	}
	return nil
}

// Run starts a hardened container and returns its id and the bound host port.
func (d *DockerRuntime) Run(ctx context.Context, spec RunSpec) (string, int, error) {
	if spec.HostPort == 0 {
		p, err := freePort()
		if err != nil {
			return "", 0, err
		}
		spec.HostPort = p
	}
	args := runArgs(spec)
	out, _, err := d.r.run(ctx, "docker", args...)
	if err != nil {
		return "", 0, fmt.Errorf("docker run: %w", err)
	}
	return strings.TrimSpace(out), spec.HostPort, nil
}

func (d *DockerRuntime) Start(ctx context.Context, id string) error {
	_, _, err := d.r.run(ctx, "docker", "start", id)
	return err
}

func (d *DockerRuntime) Stop(ctx context.Context, id string) error {
	_, _, err := d.r.run(ctx, "docker", "stop", id)
	if err != nil && !isNotFound(err) {
		return err
	}
	return nil
}

func (d *DockerRuntime) Remove(ctx context.Context, id string) error {
	_, _, err := d.r.run(ctx, "docker", "rm", "-f", id)
	if err != nil && !isNotFound(err) {
		return err
	}
	return nil
}

func (d *DockerRuntime) RemoveImage(ctx context.Context, image string) error {
	_, _, err := d.r.run(ctx, "docker", "rmi", "-f", image)
	if err != nil && !isNotFound(err) {
		return err
	}
	return nil
}

// PruneDangling removes dangling images and reclaims build cache to keep host
// disk usage bounded.
func (d *DockerRuntime) PruneDangling(ctx context.Context) error {
	if _, _, err := d.r.run(ctx, "docker", "image", "prune", "-f"); err != nil {
		return fmt.Errorf("image prune: %w", err)
	}
	if _, _, err := d.r.run(ctx, "docker", "builder", "prune", "-f"); err != nil {
		return fmt.Errorf("builder prune: %w", err)
	}
	return nil
}

// ListManaged returns all containers labelled as prevly-managed.
func (d *DockerRuntime) ListManaged(ctx context.Context) ([]Container, error) {
	out, _, err := d.r.run(ctx, "docker", "ps", "-a",
		"--filter", "label="+model.LabelManaged+"=true",
		"--format", "{{.ID}}\t{{.Names}}\t{{.State}}\t{{.Label \""+model.LabelRepo+"\"}}\t{{.Label \""+model.LabelPR+"\"}}\t{{.Label \""+model.LabelApp+"\"}}")
	if err != nil {
		return nil, err
	}
	return parsePS(out), nil
}

func parsePS(out string) []Container {
	var cs []Container
	for line := range strings.SplitSeq(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		f := strings.Split(line, "\t")
		if len(f) < 6 {
			continue
		}
		pr, _ := strconv.Atoi(f[4])
		cs = append(cs, Container{ID: f[0], Name: f[1], State: f[2], Repo: f[3], PR: pr, App: f[5]})
	}
	return cs
}

// runArgs builds the hardened `docker run` argument list. Kept pure so the
// security baseline can be asserted in tests without a Docker daemon.
func runArgs(spec RunSpec) []string {
	args := []string{
		"run", "-d",
		"--name", spec.Name,
		"--network", spec.Network,
		"--restart", "no",
		// Security baseline (docs/security.md): no privileges, drop all caps.
		"--cap-drop=ALL",
		"--security-opt=no-new-privileges",
	}
	if spec.ReadOnlyRoot {
		args = append(args, "--read-only", "--tmpfs", "/tmp", "--tmpfs", "/run")
	}
	if spec.Limits.CPU != "" {
		args = append(args, "--cpus", spec.Limits.CPU)
	}
	if spec.Limits.Memory != "" {
		args = append(args, "--memory", spec.Limits.Memory)
	}
	if spec.Limits.PIDs > 0 {
		args = append(args, "--pids-limit", strconv.FormatInt(spec.Limits.PIDs, 10))
	}
	// Publish only to loopback so the embedded proxy can reach the container
	// while the container stays off any host-reachable interface.
	args = append(args, "-p", fmt.Sprintf("127.0.0.1:%d:%d", spec.HostPort, spec.ContainerPort))

	for _, k := range sortedKeys(spec.Labels) {
		args = append(args, "--label", k+"="+spec.Labels[k])
	}
	for _, k := range sortedKeys(spec.Env) {
		args = append(args, "-e", k+"="+spec.Env[k])
	}
	for _, k := range sortedKeys(spec.Secrets) {
		args = append(args, "-e", k+"="+spec.Secrets[k])
	}
	args = append(args, spec.Image)
	return args
}

func sortedKeys(m map[string]string) []string {
	if len(m) == 0 {
		return nil
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("allocate port: %w", err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "no such") || strings.Contains(s, "not found")
}
