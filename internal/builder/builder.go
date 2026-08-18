// Package builder builds preview images on the host Docker daemon using
// BuildKit. Builds run PR code (install/build scripts) and are therefore treated
// as untrusted; images are built locally and never pushed to a registry. A
// per-app stable image tag lets BuildKit reuse the daemon's layer cache for
// warm rebuilds.
package builder

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
)

// BuildSpec describes one image build.
type BuildSpec struct {
	ContextDir string            // build context directory on disk
	Dockerfile string            // path to the Dockerfile (relative to ContextDir or absolute)
	ImageTag   string            // local tag to produce
	BuildArgs  map[string]string // public, baked into the image
	// Secrets maps a BuildKit secret id (must match the Dockerfile's
	// `--mount=type=secret,id=...`) to its resolved value. Passed via
	// `docker build --secret id=<name>,env=<VAR>`, never as a build arg or argv.
	Secrets map[string]string
}

// BuildResult carries the produced tag and the build log (for PR feedback).
type BuildResult struct {
	ImageTag string
	Log      string
}

// Builder checks out PR source and builds preview images. Implemented by
// DockerBuilder; an interface so the reconciler can be tested with a fake.
type Builder interface {
	Checkout(ctx context.Context, opts CheckoutOptions) error
	Build(ctx context.Context, spec BuildSpec) (BuildResult, error)
}

type runner interface {
	run(ctx context.Context, env []string, name string, args ...string) (output string, err error)
}

type execRunner struct{}

func (execRunner) run(ctx context.Context, env []string, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = env
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	return buf.String(), err
}

// DockerBuilder builds via the docker CLI with BuildKit enabled.
type DockerBuilder struct {
	r runner
	// extraEnv is the base environment for build commands.
	extraEnv []string
}

// New returns a DockerBuilder using the real docker CLI.
func New() *DockerBuilder {
	return &DockerBuilder{r: execRunner{}, extraEnv: []string{"DOCKER_BUILDKIT=1"}}
}

// Build runs `docker build` and returns the tag plus captured log.
func (b *DockerBuilder) Build(ctx context.Context, spec BuildSpec) (BuildResult, error) {
	args, secretEnv := buildArgs(spec)
	out, err := b.r.run(ctx, append(b.buildEnv(), secretEnv...), "docker", args...)
	res := BuildResult{ImageTag: spec.ImageTag, Log: out}
	if err != nil {
		return res, fmt.Errorf("docker build: %w", err)
	}
	return res, nil
}

func (b *DockerBuilder) buildEnv() []string {
	// Inherit the daemon process env and force BuildKit on (extraEnv wins as it
	// is appended last).
	return append(os.Environ(), b.extraEnv...)
}

// buildArgs builds the `docker build` argument list, plus the env assignments
// ("VAR=value") that must be appended to the process env so the `--secret
// id=...,env=VAR` references it resolves to. Values never appear in argv, so
// they never land in `docker inspect`/process-listing output. Pure for
// testability.
func buildArgs(spec BuildSpec) ([]string, []string) {
	dockerfile := spec.Dockerfile
	if !filepath.IsAbs(dockerfile) {
		dockerfile = filepath.Join(spec.ContextDir, spec.Dockerfile)
	}
	args := []string{
		"build",
		"--tag", spec.ImageTag,
		"--file", dockerfile,
		// Enable inline cache so warm rebuilds reuse layers.
		"--build-arg", "BUILDKIT_INLINE_CACHE=1",
	}
	for _, k := range sortedKeys(spec.BuildArgs) {
		args = append(args, "--build-arg", k+"="+spec.BuildArgs[k])
	}
	var secretEnv []string
	for i, name := range sortedKeys(spec.Secrets) {
		envVar := fmt.Sprintf("PREVLY_BUILD_SECRET_%d", i)
		args = append(args, "--secret", fmt.Sprintf("id=%s,env=%s", name, envVar))
		secretEnv = append(secretEnv, envVar+"="+spec.Secrets[name])
	}
	args = append(args, spec.ContextDir)
	return args, secretEnv
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
