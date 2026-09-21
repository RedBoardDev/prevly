package feedback

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/ingress"
	applog "github.com/RedBoardDev/prevly/internal/log"
)

type e2eResolver struct {
	t        *testing.T
	upstream string
}

func (r *e2eResolver) Resolve(_ context.Context, host string) (ingress.Target, bool, error) {
	if host != previewHost {
		return ingress.Target{}, false, nil
	}
	return ingress.Target{Upstream: r.upstream}, true, nil
}

func (r *e2eResolver) Known(host string) bool { return host == previewHost }

// TestThroughRealProxy drives the actual ingress.Proxy handler: the widget tag
// must reach the browser and /_prevly/ must be answered by the daemon without
// touching the upstream.
func TestThroughRealProxy(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())

	var upstreamHits int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamHits++
		if strings.HasPrefix(r.URL.Path, "/_prevly/") {
			t.Errorf("upstream must never see %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, "<html><body>hi</body></html>")
	}))
	t.Cleanup(upstream.Close)

	cfg := &config.HostConfig{
		BaseDomain: "preview.example.com",
		TLS:        config.TLSConfig{Mode: config.TLSModeOnDemand, Email: "a@b.c"},
		DataDir:    t.TempDir(),
	}
	proxy := ingress.NewProxy(
		&e2eResolver{t: t, upstream: strings.TrimPrefix(upstream.URL, "http://")},
		cfg,
		applog.New(applog.Options{Level: "error", Out: io.Discard}),
	)
	proxy.SetInjector(f.svc)
	proxy.SetPreviewPathHandler("/_prevly/", f.svc.PreviewHandler())

	page := get(t, proxy, previewHost, "/reports/123")
	if page.Code != http.StatusOK {
		t.Fatalf("page status = %d", page.Code)
	}
	if !strings.Contains(page.Body.String(), scriptTag) {
		t.Fatalf("widget tag not injected:\n%s", page.Body)
	}
	if !strings.Contains(page.Body.String(), "hi") {
		t.Fatalf("upstream body lost:\n%s", page.Body)
	}

	list := get(t, proxy, previewHost, "/_prevly/api/feedback")
	if list.Code != http.StatusOK {
		t.Fatalf("api status = %d", list.Code)
	}
	if got := strings.TrimSpace(list.Body.String()); got != `{"items":[]}` {
		t.Fatalf("api body = %s", got)
	}

	created := post(t, proxy, previewHost, validMeta(), pngBytes())
	if created.Code != http.StatusCreated {
		t.Fatalf("post status = %d body = %s", created.Code, created.Body)
	}
	if id, _ := decodeItem(t, created.Body.Bytes())["id"].(string); !validID(id) {
		t.Fatalf("bad id through the proxy: %q", id)
	}

	if upstreamHits != 1 {
		t.Fatalf("upstream served %d requests, want only the HTML page", upstreamHits)
	}
}
