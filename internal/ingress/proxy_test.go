package ingress

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"strings"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
)

type fakeResolver struct {
	upstream string
	known    bool
	woke     bool
}

func (f *fakeResolver) Resolve(_ context.Context, host string) (Target, bool, error) {
	if !f.known {
		return Target{}, false, nil
	}
	f.woke = true
	return Target{Upstream: f.upstream}, true, nil
}

func (f *fakeResolver) Known(string) bool { return f.known }

func newTestProxy(r Resolver) *Proxy {
	p := &Proxy{resolver: r, logger: applog.New(applog.Options{Level: "error", Out: io.Discard})}
	p.rp = &httputil.ReverseProxy{Rewrite: p.rewrite, ModifyResponse: p.modifyResponse, ErrorHandler: p.proxyError}
	return p
}

func TestProxyRoutesToUpstream(t *testing.T) {
	t.Parallel()
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "hello from "+r.Host)
	}))
	defer backend.Close()

	upstream := strings.TrimPrefix(backend.URL, "http://")
	res := &fakeResolver{upstream: upstream, known: true}
	p := newTestProxy(res)

	req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com/", nil)
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	body, _ := io.ReadAll(rec.Result().Body)
	if !strings.Contains(string(body), "hello from") {
		t.Fatalf("unexpected body: %q", body)
	}
	if !res.woke {
		t.Fatal("resolver should have been consulted (wake-on-request)")
	}
}

func TestProxyUnknownHost404(t *testing.T) {
	t.Parallel()
	p := newTestProxy(&fakeResolver{known: false})
	req := httptest.NewRequest(http.MethodGet, "http://pr-99.example.com/", nil)
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestOnDemandDecision(t *testing.T) {
	t.Parallel()
	p := newTestProxy(&fakeResolver{known: true})
	if err := p.onDemandDecision(context.Background(), "pr-1.example.com"); err != nil {
		t.Fatalf("known host should be allowed: %v", err)
	}
	p2 := newTestProxy(&fakeResolver{known: false})
	if err := p2.onDemandDecision(context.Background(), "evil.example.com"); err == nil {
		t.Fatal("unknown host must be denied on-demand issuance")
	}
}

func TestDNSProviderFactory(t *testing.T) {
	t.Parallel()
	if _, err := dnsProvider("route53"); err != nil {
		t.Fatalf("route53: %v", err)
	}
	if _, err := dnsProvider("bogus"); err == nil {
		t.Fatal("unknown provider must error")
	}
}

func TestHostOnly(t *testing.T) {
	t.Parallel()
	if got := hostOnly("pr-1.example.com:443"); got != "pr-1.example.com" {
		t.Fatalf("hostOnly = %q", got)
	}
	if got := hostOnly("pr-1.example.com"); got != "pr-1.example.com" {
		t.Fatalf("hostOnly = %q", got)
	}
}

// In external mode the front end forwards over plain HTTP: Run must serve the
// proxy itself in cleartext, never a redirect to https that would bounce the
// request straight back to the front end.
func TestExternalModeServesCleartextWithoutRedirect(t *testing.T) {
	t.Parallel()
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "upstream")
	}))
	defer backend.Close()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve port: %v", err)
	}
	addr := ln.Addr().String()
	_ = ln.Close()

	p := newTestProxy(&fakeResolver{upstream: strings.TrimPrefix(backend.URL, "http://"), known: true})
	p.tls = config.TLSConfig{Mode: config.TLSModeExternal}
	p.httpAddr = addr

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- p.Run(ctx) }()

	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	var resp *http.Response
	for range 50 {
		resp, err = client.Get("http://" + addr + "/")
		if err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (no redirect to https)", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "upstream" {
		t.Fatalf("body = %q, want %q", body, "upstream")
	}

	cancel()
	if err := <-done; err != nil {
		t.Fatalf("run: %v", err)
	}
}
