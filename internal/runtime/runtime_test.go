package runtime

import (
	"context"
	"strings"
	"testing"

	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/model"
)

func TestRunArgsHardening(t *testing.T) {
	t.Parallel()
	spec := RunSpec{
		Name:          "prevly-org-repo-pr42-bo",
		Image:         "prevly/org-repo/bo:pr-42-abc",
		Network:       "prevlynet-org-repo-pr42-bo",
		ContainerPort: 3000,
		HostPort:      40123,
		ReadOnlyRoot:  true,
		Env:           map[string]string{"NODE_ENV": "production"},
		Secrets:       map[string]string{"SA_KEY": "s3cr3t"},
		Limits:        config.PerPreview{CPU: "1.5", Memory: "512m", PIDs: 512},
		Labels:        map[string]string{model.LabelManaged: "true"},
	}
	args := runArgs(spec)
	joined := strings.Join(args, " ")

	mustContain := []string{
		"--cap-drop=ALL",
		"--security-opt=no-new-privileges",
		"--read-only",
		"--cpus 1.5",
		"--memory 512m",
		"--pids-limit 512",
		"--network prevlynet-org-repo-pr42-bo",
		"127.0.0.1:40123:3000",
		"-e NODE_ENV=production",
		"-e SA_KEY=s3cr3t",
		"--label prevly.managed=true",
	}
	for _, want := range mustContain {
		if !strings.Contains(joined, want) {
			t.Errorf("run args missing %q\nargs: %s", want, joined)
		}
	}

	// The Docker socket must NEVER be mounted into a preview.
	if strings.Contains(joined, "docker.sock") || strings.Contains(joined, "-v ") {
		t.Fatalf("preview must not mount any volume / docker socket: %s", joined)
	}
	if args[0] != "run" || args[1] != "-d" {
		t.Fatalf("expected detached run, got %v", args[:2])
	}
}

func TestRunArgsNoReadOnlyWhenDisabled(t *testing.T) {
	t.Parallel()
	args := runArgs(RunSpec{Name: "n", Image: "i", Network: "net", ContainerPort: 80, HostPort: 1})
	if strings.Contains(strings.Join(args, " "), "--read-only") {
		t.Fatal("read-only should be opt-in via ReadOnlyRoot")
	}
}

type fakeRunner struct {
	calls   [][]string
	outputs map[string]string
	errs    map[string]error
}

func (f *fakeRunner) run(_ context.Context, name string, args ...string) (string, string, error) {
	key := name + " " + strings.Join(args, " ")
	f.calls = append(f.calls, append([]string{name}, args...))
	return f.outputs[key], "", f.errs[key]
}

func TestRunReturnsContainerID(t *testing.T) {
	t.Parallel()
	f := &fakeRunner{outputs: map[string]string{}}
	d := &DockerRuntime{r: f}
	spec := RunSpec{Name: "n", Image: "i", Network: "net", ContainerPort: 80, HostPort: 5000}
	// Predict the exact command key to stub its output.
	key := "docker " + strings.Join(runArgs(spec), " ")
	f.outputs[key] = "container1234\n"

	id, hp, err := d.Run(context.Background(), spec)
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	if id != "container1234" {
		t.Fatalf("container id = %q", id)
	}
	if hp != 5000 {
		t.Fatalf("host port = %d", hp)
	}
}

func TestParsePS(t *testing.T) {
	t.Parallel()
	out := "abc\tprevly-org-repo-pr42-bo\trunning\torg/repo\t42\tbo\n" +
		"def\tprevly-org-repo-pr7-web\texited\torg/other\t7\tweb\n"
	cs := parsePS(out)
	if len(cs) != 2 {
		t.Fatalf("want 2 containers, got %d", len(cs))
	}
	if cs[0].Repo != "org/repo" || cs[0].PR != 42 || cs[0].App != "bo" || cs[0].State != "running" {
		t.Fatalf("unexpected container: %+v", cs[0])
	}
}
