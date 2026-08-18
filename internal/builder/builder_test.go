package builder

import (
	"context"
	"slices"
	"strings"
	"testing"
)

func TestBuildArgs(t *testing.T) {
	t.Parallel()
	spec := BuildSpec{
		ContextDir: "/work/checkout",
		Dockerfile: "apps/bo/Dockerfile",
		ImageTag:   "prevly/org-repo/bo:pr-42-abc",
		BuildArgs:  map[string]string{"NEXT_PUBLIC_API_URL": "https://api.example.com", "FOO": "bar"},
	}
	args, secretEnv := buildArgs(spec)
	joined := strings.Join(args, " ")

	for _, want := range []string{
		"--tag prevly/org-repo/bo:pr-42-abc",
		"--file /work/checkout/apps/bo/Dockerfile",
		"--build-arg BUILDKIT_INLINE_CACHE=1",
		"--build-arg FOO=bar",
		"--build-arg NEXT_PUBLIC_API_URL=https://api.example.com",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("build args missing %q\nargs: %s", want, joined)
		}
	}
	if args[0] != "build" {
		t.Fatalf("first arg = %q", args[0])
	}
	if args[len(args)-1] != "/work/checkout" {
		t.Fatalf("context must be last arg, got %q", args[len(args)-1])
	}
	if len(secretEnv) != 0 {
		t.Fatalf("no secrets in spec, expected no secret env: %v", secretEnv)
	}
}

func TestBuildArgsAbsoluteDockerfile(t *testing.T) {
	t.Parallel()
	args, _ := buildArgs(BuildSpec{ContextDir: "/ctx", Dockerfile: "/abs/Dockerfile", ImageTag: "t"})
	if !strings.Contains(strings.Join(args, " "), "--file /abs/Dockerfile") {
		t.Fatalf("absolute dockerfile should be used as-is: %v", args)
	}
}

func TestBuildArgsSecretsNeverInArgv(t *testing.T) {
	t.Parallel()
	spec := BuildSpec{
		ContextDir: "/ctx",
		Dockerfile: "Dockerfile",
		ImageTag:   "t",
		Secrets:    map[string]string{"heroui_auth_token": "super-secret-value"},
	}
	args, secretEnv := buildArgs(spec)
	joined := strings.Join(args, " ")
	if strings.Contains(joined, "super-secret-value") {
		t.Fatalf("secret value leaked into argv: %v", args)
	}
	if !strings.Contains(joined, "--secret id=heroui_auth_token,env=PREVLY_BUILD_SECRET_0") {
		t.Fatalf("missing --secret flag for heroui_auth_token: %v", args)
	}
	if !slices.Contains(secretEnv, "PREVLY_BUILD_SECRET_0=super-secret-value") {
		t.Fatalf("secret value not carried via env: %v", secretEnv)
	}
}

type fakeRunner struct {
	output string
	err    error
	gotEnv []string
}

func (f *fakeRunner) run(_ context.Context, env []string, _ string, _ ...string) (string, error) {
	f.gotEnv = env
	return f.output, f.err
}

func TestBuildEnablesBuildKit(t *testing.T) {
	t.Parallel()
	f := &fakeRunner{output: "built"}
	b := &DockerBuilder{r: f, extraEnv: []string{"DOCKER_BUILDKIT=1"}}
	res, err := b.Build(context.Background(), BuildSpec{ContextDir: "/c", Dockerfile: "Dockerfile", ImageTag: "t"})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if res.Log != "built" || res.ImageTag != "t" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if !slices.Contains(f.gotEnv, "DOCKER_BUILDKIT=1") {
		t.Fatalf("BuildKit not enabled; env: %v", f.gotEnv)
	}
}
