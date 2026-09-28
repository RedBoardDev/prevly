package feedback

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestAPIRequiresFeedbackCookie proves anonymous internet cannot read or write
// a preview's feedback: only a request carrying the exact token as a cookie is
// let through.
func TestAPIRequiresFeedbackCookie(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	h := f.svc.PreviewHandler()

	if rec := getAs(t, h, previewHost, "", "/_prevly/api/feedback"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("GET without cookie: status = %d, want 401", rec.Code)
	}
	if rec := getAs(t, h, previewHost, "wrong-token", "/_prevly/api/feedback"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("GET with wrong cookie: status = %d, want 401", rec.Code)
	}
	if rec := postAs(t, h, previewHost, "", validMeta(), nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("POST without cookie: status = %d, want 401", rec.Code)
	}
	if rec := postAs(t, h, previewHost, "wrong-token", validMeta(), nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("POST with wrong cookie: status = %d, want 401", rec.Code)
	}

	all, err := f.store.ListFeedback()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(all) != 0 {
		t.Fatalf("an unauthorized post must not be stored: %+v", all)
	}

	if rec := getAs(t, h, previewHost, testToken, "/_prevly/api/feedback"); rec.Code != http.StatusOK {
		t.Fatalf("GET with the right cookie: status = %d, want 200", rec.Code)
	}
}

// TestFeedbackJSAndScreenshotStayPublic proves the badge still renders and
// GitHub's camo proxy can still fetch a screenshot with no cookie at all.
func TestFeedbackJSAndScreenshotStayPublic(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	h := f.svc.PreviewHandler()

	rec := post(t, h, previewHost, validMeta(), pngBytes())
	id, _ := decodeItem(t, rec.Body.Bytes())["id"].(string)

	if got := getAs(t, h, previewHost, "", "/_prevly/feedback.js"); got.Code != http.StatusOK {
		t.Fatalf("feedback.js without a cookie: status = %d", got.Code)
	}
	if got := getAs(t, h, previewHost, "", "/_prevly/feedback/"+id+"/screenshot.png"); got.Code != http.StatusOK {
		t.Fatalf("screenshot without a cookie: status = %d", got.Code)
	}
}

// TestActivateSetsCookieAndRedirects drives the link posted to the sticky
// comment: a matching token gates in the reviewer with a scoped, no-store
// cookie and sends them back to the app.
func TestActivateSetsCookieAndRedirects(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	req := httptest.NewRequest(http.MethodGet, "/_prevly/activate?t="+testToken, nil)
	req.Host = previewHost
	rec := httptest.NewRecorder()
	f.svc.PreviewHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	if loc := rec.Header().Get("Location"); loc != "/" {
		t.Fatalf("Location = %q, want \"/\"", loc)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("Cache-Control = %q", rec.Header().Get("Cache-Control"))
	}
	if rec.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("Referrer-Policy = %q", rec.Header().Get("Referrer-Policy"))
	}

	result := (&http.Response{Header: rec.Header()})
	cookies := result.Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies = %+v, want exactly one", cookies)
	}
	c := cookies[0]
	if c.Name != feedbackCookie || c.Value != testToken {
		t.Fatalf("cookie = %+v", c)
	}
	if c.Path != "/_prevly/" {
		t.Fatalf("cookie path = %q, want /_prevly/ so the previewed app never sees it", c.Path)
	}
	if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteStrictMode {
		t.Fatalf("cookie attributes = %+v", c)
	}
	if c.MaxAge <= 0 {
		t.Fatalf("MaxAge = %d, want a positive lifetime", c.MaxAge)
	}
}

func TestActivateUsesPreviewTTLForMaxAge(t *testing.T) {
	t.Parallel()
	p := livePreview()
	p.TTL = 2 * time.Hour
	f := newFixture(t, defaultConfig(), p)

	req := httptest.NewRequest(http.MethodGet, "/_prevly/activate?t="+testToken, nil)
	req.Host = previewHost
	rec := httptest.NewRecorder()
	f.svc.PreviewHandler().ServeHTTP(rec, req)

	result := (&http.Response{Header: rec.Header()})
	cookies := result.Cookies()
	if len(cookies) != 1 || cookies[0].MaxAge != 2*3600 {
		t.Fatalf("cookies = %+v, want MaxAge = %d", cookies, 2*3600)
	}
}

// TestActivateIsIndistinguishableFromUnknownPath proves a wrong token, an
// empty token and an unknown host all answer 404, identical to any other
// unknown path, so the endpoint reveals nothing to a guess.
func TestActivateIsIndistinguishableFromUnknownPath(t *testing.T) {
	t.Parallel()
	noToken := livePreview()
	noToken.PRNumber = 43
	noToken.Host = "pr-43-web.preview.example.com"
	noToken.FeedbackToken = ""
	f := newFixture(t, defaultConfig(), livePreview(), noToken)
	h := f.svc.PreviewHandler()

	cases := []struct {
		name string
		host string
		t    string
	}{
		{"wrong token", previewHost, "not-the-token"},
		{"empty token", previewHost, ""},
		{"unknown host", "nobody.preview.example.com", testToken},
		{"backfill pending: no token on record", noToken.Host, testToken},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodGet, "/_prevly/activate?t="+tc.t, nil)
			req.Host = tc.host
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			plain := httptest.NewRequest(http.MethodGet, "/_prevly/does-not-exist", nil)
			plain.Host = tc.host
			plainRec := httptest.NewRecorder()
			h.ServeHTTP(plainRec, plain)

			if rec.Code != http.StatusNotFound || rec.Code != plainRec.Code {
				t.Fatalf("status = %d, unknown-path status = %d, want both 404", rec.Code, plainRec.Code)
			}
			if rec.Body.String() != plainRec.Body.String() {
				t.Fatalf("body = %q, unknown-path body = %q, want identical", rec.Body.String(), plainRec.Body.String())
			}
			if len((&http.Response{Header: rec.Header()}).Cookies()) != 0 {
				t.Fatal("a failed activation must never set a cookie")
			}
		})
	}
}

func TestControlHandlerHasNoActivateRoute(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/_prevly/activate?t="+testToken, nil)
	req.Host = "preview.example.com"
	f.svc.ControlHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404: activation only ever applies to a preview host", rec.Code)
	}
}
