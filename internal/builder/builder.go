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
	args := buildArgs(spec)
	out, err := b.r.run(ctx, b.buildEnv(), "docker", args...)
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

// buildArgs builds the `docker build` argument list. Pure for testability.
func buildArgs(spec BuildSpec) []string {
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
	args = append(args, spec.ContextDir)
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
