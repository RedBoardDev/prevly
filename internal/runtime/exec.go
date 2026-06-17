package runtime

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
)

// runner executes external commands; injected so the Docker runtime can be
// tested without a real daemon.
type runner interface {
	run(ctx context.Context, name string, args ...string) (stdout string, stderr string, err error)
}

type execRunner struct{}

func (execRunner) run(ctx context.Context, name string, args ...string) (string, string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var out, errb bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errb
	err := cmd.Run()
	if err != nil {
		err = fmt.Errorf("%s: %w: %s", name, err, errb.String())
	}
	return out.String(), errb.String(), err
}
