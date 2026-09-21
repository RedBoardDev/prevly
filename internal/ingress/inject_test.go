package ingress

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"strconv"
	"strings"
	"testing"
)

const testTag = `<script src="/_prevly/feedback.js" defer></script>`

type fakeInjector struct {
	tag  string
	ok   bool
	host string
}

func (f *fakeInjector) InjectTag(host string) (string, bool) {
	f.host = host
	return f.tag, f.ok
}

type strictResolver struct {
	t        *testing.T
	upstream string
	known    bool
}

func (r *strictResolver) Resolve(context.Context, string) (Target, bool, error) {
	r.t.Helper()
	r.t.Fatal("Resolve must not be called: it wakes a sleeping preview")
	return Target{}, false, nil
}

func (r *strictResolver) Known(string) bool { return r.known }

func serveProxy(t *testing.T, inj Injector, req *http.Request, h http.HandlerFunc) *http.Response {
	t.Helper()
	backend := httptest.NewServer(h)
	t.Cleanup(backend.Close)

	p := newTestProxy(&fakeResolver{upstream: strings.TrimPrefix(backend.URL, "http://"), known: true})
	if inj != nil {
		p.SetInjector(inj)
	}
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, req)
	return rec.Result()
}

func htmlBackend(body string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, body)
	}
}

func TestInjectPlacement(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		body string
		want string
	}{
		{"before body close", "<html><body>hi</body></html>", "<html><body>hi" + testTag + "</body></html>"},
		{"last body close wins", "<p>&lt;/body&gt;</p><body>a</body>", "<p>&lt;/body&gt;</p><body>a" + testTag + "</body>"},
		{"before html close when no body tag", "<html><p>hi</p></html>", "<html><p>hi</p>" + testTag + "</html>"},
		{"uppercase body close", "<HTML><BODY>hi</BODY></HTML>", "<HTML><BODY>hi" + testTag + "</BODY></HTML>"},
		{"mixed case body close", "<html><body>hi</Body></html>", "<html><body>hi" + testTag + "</Body></html>"},
		{"appended when no closing tag", "<p>fragment</p>", "<p>fragment</p>" + testTag},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com/", nil)
			res := serveProxy(t, &fakeInjector{tag: testTag, ok: true}, req, htmlBackend(tc.body))

			body, _ := io.ReadAll(res.Body)
			if string(body) != tc.want {
				t.Fatalf("body = %q, want %q", body, tc.want)
			}
			if got := res.Header.Get("Content-Length"); got != strconv.Itoa(len(tc.want)) {
				t.Fatalf("Content-Length = %q, want %d", got, len(tc.want))
			}
			if got := res.Header.Get("Content-Encoding"); got != "" {
				t.Fatalf("Content-Encoding = %q, want removed", got)
			}
		})
	}
}

func TestInjectHostIsPortless(t *testing.T) {
	t.Parallel()
	inj := &fakeInjector{tag: testTag, ok: true}
	req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com:443/", nil)
	serveProxy(t, inj, req, htmlBackend("<html><body>hi</body></html>"))
	if inj.host != "pr-42-bo.example.com" {
		t.Fatalf("InjectTag host = %q", inj.host)
	}
}

func TestInjectContentLengthMultibyte(t *testing.T) {
	t.Parallel()
	const page = "<html><body>héllo → 日本語</body></html>"
	req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com/", nil)
	res := serveProxy(t, &fakeInjector{tag: testTag, ok: true}, req, htmlBackend(page))

	body, _ := io.ReadAll(res.Body)
	want := len(page) + len(testTag)
	if len(body) != want {
		t.Fatalf("body length = %d, want %d", len(body), want)
	}
	if got := res.Header.Get("Content-Length"); got != strconv.Itoa(want) {
		t.Fatalf("Content-Length = %q, want %d", got, want)
	}
	if !strings.Contains(string(body), "日本語"+testTag+"</body>") {
		t.Fatalf("unexpected body: %q", body)
	}
}

func TestPassthrough(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		inj     Injector
		method  string
		accept  string
		handler http.HandlerFunc
		want    string
	}{
		{
			name:    "no injector",
			want:    "<html><body>hi</body></html>",
			handler: htmlBackend("<html><body>hi</body></html>"),
		},
		{
			name:    "injector declines host",
			inj:     &fakeInjector{ok: false},
			want:    "<html><body>hi</body></html>",
			handler: htmlBackend("<html><body>hi</body></html>"),
		},
		{
			name:    "empty tag",
			inj:     &fakeInjector{tag: "", ok: true},
			want:    "<html><body>hi</body></html>",
			handler: htmlBackend("<html><body>hi</body></html>"),
		},
		{
			name: "rsc payload",
			inj:  &fakeInjector{tag: testTag, ok: true},
			want: "0:[\"$\",\"body\",null]\n",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "text/x-component")
				_, _ = io.WriteString(w, "0:[\"$\",\"body\",null]\n")
			},
		},
		{
			name: "json",
			inj:  &fakeInjector{tag: testTag, ok: true},
			want: `{"body":"</body>"}`,
			handler: func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"body":"</body>"}`)
			},
		},
		{
			name: "non 200",
			inj:  &fakeInjector{tag: testTag, ok: true},
			want: "<html><body>nope</body></html>",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusNotFound)
				_, _ = io.WriteString(w, "<html><body>nope</body></html>")
			},
		},
		{
			name:   "compressed upstream",
			inj:    &fakeInjector{tag: testTag, ok: true},
			accept: "text/html",
			want:   "\x1b\x01\x00brotli-bytes",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.Header().Set("Content-Encoding", "br")
				_, _ = io.WriteString(w, "\x1b\x01\x00brotli-bytes")
			},
		},
		{
			name:    "non GET",
			inj:     &fakeInjector{tag: testTag, ok: true},
			method:  http.MethodPost,
			want:    "<html><body>hi</body></html>",
			handler: htmlBackend("<html><body>hi</body></html>"),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			method := tc.method
			if method == "" {
				method = http.MethodGet
			}
			req := httptest.NewRequest(method, "http://pr-42-bo.example.com/", nil)
			if tc.accept != "" {
				req.Header.Set("Accept", tc.accept)
			}
			res := serveProxy(t, tc.inj, req, tc.handler)
			body, _ := io.ReadAll(res.Body)
			if string(body) != tc.want {
				t.Fatalf("body = %q, want %q", body, tc.want)
			}
		})
	}
}

func TestOversizeBodyPassthrough(t *testing.T) {
	t.Parallel()
	page := "<html><body>" + strings.Repeat("x", maxInjectBody) + "</body></html>"
	req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com/", nil)
	res := serveProxy(t, &fakeInjector{tag: testTag, ok: true}, req, htmlBackend(page))

	body, _ := io.ReadAll(res.Body)
	if string(body) != page {
		t.Fatalf("oversize body was altered (len %d, want %d)", len(body), len(page))
	}
}

func TestInjectAtExactLimit(t *testing.T) {
	t.Parallel()
	filler := strings.Repeat("x", maxInjectBody-len("<html><body></body></html>"))
	page := "<html><body>" + filler + "</body></html>"
	if len(page) != maxInjectBody {
		t.Fatalf("page length = %d, want %d", len(page), maxInjectBody)
	}
	req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com/", nil)
	res := serveProxy(t, &fakeInjector{tag: testTag, ok: true}, req, htmlBackend(page))

	body, _ := io.ReadAll(res.Body)
	if len(body) != maxInjectBody+len(testTag) {
		t.Fatalf("body length = %d, want %d", len(body), maxInjectBody+len(testTag))
	}
	if !strings.HasSuffix(string(body), testTag+"</body></html>") {
		t.Fatalf("tag not injected at limit")
	}
}

func TestPreviewPathHandlerSkipsResolve(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		known bool
		path  string
		want  int
	}{
		{"known host", true, "/_prevly/feedback.js", http.StatusOK},
		{"unknown host still reaches handler", false, "/_prevly/feedback.js", http.StatusOK},
		{"handler owns its 404", true, "/_prevly/nope", http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			p := newTestProxy(&strictResolver{t: t, known: tc.known})
			p.SetPreviewPathHandler("/_prevly/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/_prevly/feedback.js" {
					http.NotFound(w, r)
					return
				}
				_, _ = io.WriteString(w, "widget on "+r.Host)
			}))

			req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com"+tc.path, nil)
			rec := httptest.NewRecorder()
			p.ServeHTTP(rec, req)

			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d", rec.Code, tc.want)
			}
			if tc.want == http.StatusOK && !strings.Contains(rec.Body.String(), "pr-42-bo.example.com") {
				t.Fatalf("handler did not see the preview host: %q", rec.Body.String())
			}
		})
	}
}

func TestPreviewPathHandlerLeavesOtherPaths(t *testing.T) {
	t.Parallel()
	res := &fakeResolver{known: false}
	p := newTestProxy(res)
	p.SetPreviewPathHandler("/_prevly/", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("handler must not serve paths outside the prefix")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com/reports", nil)
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 from the resolver", rec.Code)
	}
}

func TestPreviewPathHandlerYieldsToControl(t *testing.T) {
	t.Parallel()
	p := newTestProxy(&strictResolver{t: t, known: true})
	p.baseDomain = "example.com"
	p.SetControlHandler(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "control")
	}))
	p.SetPreviewPathHandler("/_prevly/", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("base domain must reach the control handler")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "http://example.com/_prevly/feedback.js", nil)
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, req)
	if rec.Body.String() != "control" {
		t.Fatalf("body = %q", rec.Body.String())
	}
}

func TestRewriteDropsAcceptEncodingForHTML(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		accept   string
		injector Injector
		want     string
	}{
		{"html navigation", "text/html,application/xhtml+xml,*/*;q=0.8", &fakeInjector{ok: true}, ""},
		{"uppercase html", "TEXT/HTML", &fakeInjector{ok: true}, ""},
		{"absent accept", "", &fakeInjector{ok: true}, ""},
		{"wildcard accept", "*/*", &fakeInjector{ok: true}, ""},
		{"rsc payload", "text/x-component", &fakeInjector{ok: true}, "br, gzip"},
		{"json", "application/json", &fakeInjector{ok: true}, "br, gzip"},
		{"image", "image/avif,image/webp", &fakeInjector{ok: true}, "br, gzip"},
		{"no injector", "text/html", nil, "br, gzip"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			p := newTestProxy(&fakeResolver{upstream: "127.0.0.1:9", known: true})
			if tc.injector != nil {
				p.SetInjector(tc.injector)
			}

			in := httptest.NewRequest(http.MethodGet, "http://pr-42-bo.example.com/", nil)
			if tc.accept != "" {
				in.Header.Set("Accept", tc.accept)
			}
			in = in.WithContext(context.WithValue(in.Context(), upstreamKey, "127.0.0.1:9"))
			out := in.Clone(in.Context())
			out.Header.Set("Accept-Encoding", "br, gzip")

			p.rewrite(&httputil.ProxyRequest{In: in, Out: out})

			if got := out.Header.Get("Accept-Encoding"); got != tc.want {
				t.Fatalf("Accept-Encoding = %q, want %q", got, tc.want)
			}
			if out.Host != in.Host {
				t.Fatalf("Host = %q, want %q", out.Host, in.Host)
			}
			if out.Header.Get("X-Forwarded-For") == "" {
				t.Fatal("X-Forwarded-For must be set")
			}
			if out.URL.Host != "127.0.0.1:9" {
				t.Fatalf("upstream = %q", out.URL.Host)
			}
		})
	}
}
