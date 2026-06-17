//go:build integration

// Integration test exercising the real data plane against a live Docker daemon:
// build -> hardened run -> proxy route -> sleep -> wake -> teardown. Run with:
//
//	go test -tags integration ./internal/reconcile/ -run Integration -v
package reconcile

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/builder"
	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/ingress"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/runtime"
	"github.com/RedBoardDev/prevly/internal/secrets"
	"github.com/RedBoardDev/prevly/internal/store"
	"strconv"
)

const itestDockerfile = `FROM busybox
RUN mkdir -p /www && printf 'prevly-ok' > /www/index.html
EXPOSE 8080
CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
`

func TestIntegrationDataPlane(t *testing.T) {
	ctx := context.Background()

	const (
		imageTag  = "prevly-itest/app:latest"
		container = "prevly-itest-app"
		network   = "prevly-itest-net"
		host      = "pr-1.preview.local"
	)

	// Clean any leftovers from a previous run.
	rt := runtime.New()
	_ = rt.Remove(ctx, container)
	_ = rt.RemoveNetwork(ctx, network)

	// 1. Build a real image with BuildKit.
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Dockerfile"), []byte(itestDockerfile), 0o644); err != nil {
		t.Fatal(err)
	}
	b := builder.New()
	if _, err := b.Build(ctx, builder.BuildSpec{ContextDir: dir, Dockerfile: "Dockerfile", ImageTag: imageTag}); err != nil {
		t.Fatalf("build: %v", err)
	}
	t.Cleanup(func() { _ = rt.RemoveImage(ctx, imageTag) })

	// 2. Hardened run.
	if err := rt.EnsureNetwork(ctx, network); err != nil {
		t.Fatalf("network: %v", err)
	}
	t.Cleanup(func() { _ = rt.RemoveNetwork(ctx, network) })

	id, port, err := rt.Run(ctx, runtime.RunSpec{
		Name:          container,
		Image:         imageTag,
		Network:       network,
		ContainerPort: 8080,
		ReadOnlyRoot:  true,
		Limits:        config.PerPreview{Memory: "128m", PIDs: 256},
		Labels:        previewLabels("org/itest", 1, "web"),
	})
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	t.Cleanup(func() { _ = rt.Remove(ctx, id) })

	// 3. The container actually serves over the loopback host port.
	if err := waitReady(ctx, port, 15*time.Second); err != nil {
		t.Fatalf("container not ready: %v", err)
	}
	assertServes(t, port)

	// 4. The hardening flags are really applied (verified via docker inspect).
	assertHardened(t, id)

	// 5. Route a request through the embedded proxy using the real resolver.
	st, err := store.Open(filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	rec := New(Deps{
		Config:  &config.HostConfig{BaseDomain: "preview.local", Limits: config.Limits{MaxConcurrentBuilds: 1, MaxConcurrentPreviews: 10}},
		Store:   st,
		Runtime: rt,
		Secrets: secrets.New(nil, func(string) (string, bool) { return "", false }),
		Logger:  applog.New(applog.Options{Level: "error", Out: io.Discard}),
	})
	preview := &model.Preview{
		Repo: "org/itest", PRNumber: 1, AppName: "web", Host: host, URL: "https://" + host,
		ContainerID: id, ImageTag: imageTag, NetworkName: network, Port: port, Status: model.StatusRunning,
		LastSeenAt: time.Now(),
	}
	if err := st.Put(preview); err != nil {
		t.Fatal(err)
	}

	target, ok, err := rec.Resolve(ctx, host)
	if err != nil || !ok {
		t.Fatalf("resolve: ok=%v err=%v", ok, err)
	}
	if !strings.HasPrefix(target.Upstream, "127.0.0.1:") {
		t.Fatalf("upstream = %q", target.Upstream)
	}
	assertProxyServes(t, rec, host)

	// 6. Sleep then wake-on-request (docker stop -> docker start, no rebuild).
	rec.Tick(ctx) // not idle yet: nothing should change
	if got, _ := st.Get("org/itest", 1, "web"); got.Status != model.StatusRunning {
		t.Fatalf("preview should still be running, got %q", got.Status)
	}

	// Force sleep.
	if err := rt.Stop(ctx, id); err != nil {
		t.Fatalf("stop: %v", err)
	}
	preview.Status = model.StatusSleeping
	if err := st.Put(preview); err != nil {
		t.Fatal(err)
	}

	// A request must wake it and serve again.
	assertProxyServes(t, rec, host)
	if got, _ := st.Get("org/itest", 1, "web"); got.Status != model.StatusRunning {
		t.Fatalf("preview should be awake (running), got %q", got.Status)
	}

	// 7. Teardown removes the container.
	if _, err := rec.Teardown(ctx, "org/itest", 1, ""); err != nil {
		t.Fatalf("teardown: %v", err)
	}
	if running := containerExists(container); running {
		t.Fatal("container should be removed after teardown")
	}
}

func newProxyForTest(rec *Reconciler) *ingress.Proxy {
	cfg := &config.HostConfig{BaseDomain: "preview.local", HTTPAddr: ":0", HTTPSAddr: ":0", DataDir: os.TempDir()}
	return ingress.NewProxy(rec, cfg, applog.New(applog.Options{Level: "error", Out: io.Discard}))
}

func assertServes(t *testing.T, port int) {
	t.Helper()
	body := httpGet(t, "http://127.0.0.1:"+strconv.Itoa(port)+"/")
	if body != "prevly-ok" {
		t.Fatalf("direct GET body = %q, want prevly-ok", body)
	}
}

func assertProxyServes(t *testing.T, rec *Reconciler, host string) {
	t.Helper()
	p := newProxyForTest(rec)
	// Retry to allow wake readiness.
	var rec200 bool
	for i := 0; i < 50; i++ {
		req := httptest.NewRequest(http.MethodGet, "http://"+host+"/", nil)
		w := httptest.NewRecorder()
		p.ServeHTTP(w, req)
		if w.Code == http.StatusOK {
			b, _ := io.ReadAll(w.Result().Body)
			if string(b) == "prevly-ok" {
				rec200 = true
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !rec200 {
		t.Fatal("proxy did not serve the container body")
	}
}

func assertHardened(t *testing.T, id string) {
	t.Helper()
	caps := dockerInspect(t, id, "{{.HostConfig.CapDrop}}")
	if !strings.Contains(caps, "ALL") {
		t.Fatalf("CapDrop = %q, want ALL", caps)
	}
	secopt := dockerInspect(t, id, "{{.HostConfig.SecurityOpt}}")
	if !strings.Contains(secopt, "no-new-privileges") {
		t.Fatalf("SecurityOpt = %q, want no-new-privileges", secopt)
	}
	ro := dockerInspect(t, id, "{{.HostConfig.ReadonlyRootfs}}")
	if strings.TrimSpace(ro) != "true" {
		t.Fatalf("ReadonlyRootfs = %q, want true", ro)
	}
	mounts := dockerInspect(t, id, "{{.HostConfig.Binds}}")
	if strings.Contains(mounts, "docker.sock") {
		t.Fatalf("container must not mount the docker socket: %q", mounts)
	}
}

func dockerInspect(t *testing.T, id, format string) string {
	t.Helper()
	out, err := exec.Command("docker", "inspect", "--format", format, id).Output()
	if err != nil {
		t.Fatalf("docker inspect: %v", err)
	}
	return string(out)
}

func containerExists(name string) bool {
	out, err := exec.Command("docker", "ps", "-aq", "--filter", "name=^/"+name+"$").Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) != ""
}

func httpGet(t *testing.T, url string) string {
	t.Helper()
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return string(b)
}
