package feedback

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/store"
)

const previewHost = "pr-42-web.preview.example.com"

type fakeGitHub struct {
	mu     sync.Mutex
	bodies []string
	err    error
}

func (f *fakeGitHub) PostComment(_ context.Context, _ int64, owner, repo string, pr int, body string) (int64, string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return 0, "", f.err
	}
	f.bodies = append(f.bodies, body)
	return int64(len(f.bodies)), "https://github.com/" + owner + "/" + repo + "/pull/42#issuecomment-1", nil
}

func (f *fakeGitHub) last() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.bodies) == 0 {
		return ""
	}
	return f.bodies[len(f.bodies)-1]
}

func (f *fakeGitHub) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.bodies)
}

type fixture struct {
	svc   *Service
	store *store.Store
	gh    *fakeGitHub
	dir   string
}

func newFixture(t *testing.T, cfg config.FeedbackConfig, seed ...*model.Preview) *fixture {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "state.db"))
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	if len(seed) == 0 {
		seed = []*model.Preview{livePreview()}
	}
	for _, p := range seed {
		if p == nil {
			continue
		}
		if err := st.Put(p); err != nil {
			t.Fatalf("seed preview: %v", err)
		}
	}

	gh := &fakeGitHub{}
	svc := New(Deps{
		Store:      st,
		GitHub:     gh,
		Config:     cfg,
		BaseDomain: "preview.example.com",
		DataDir:    dir,
		Logger:     applog.New(applog.Options{Level: "error", Out: io.Discard}),
	})
	return &fixture{svc: svc, store: st, gh: gh, dir: filepath.Join(dir, "feedback")}
}

func defaultConfig() config.FeedbackConfig {
	return config.FeedbackConfig{Retention: config.Duration(90 * 24 * time.Hour), MaxPerHour: 30}
}

func livePreview() *model.Preview {
	return &model.Preview{
		Repo: "org/repo", PRNumber: 42, AppName: "web",
		Host: previewHost, URL: "https://" + previewHost,
		Status: model.StatusRunning, InstallationID: 7, CommitSHA: "abc1234def",
		FeedbackEnabled: boolPtr(true),
	}
}

func pngBytes() []byte {
	return append(bytes.Clone(pngMagic), []byte("not-a-real-image-but-enough")...)
}

func validMeta() string {
	return `{"author":"Thomas","comment":"The total is wrong","page":"/reports/123?tab=costs",` +
		`"title":"Report","selector":"main td.total","element":{"tag":"td","text":"1 234,00 €"},` +
		`"click":{"x":812,"y":403},"rect":{"x":780,"y":390,"w":96,"h":28},` +
		`"viewport":{"w":1440,"h":900,"dpr":2},"userAgent":"Mozilla/5.0",` +
		`"console":[{"level":"error","message":"TypeError: boom","at":"2026-09-21T10:12:33Z"}]}`
}

func multipartBody(t *testing.T, meta string, screenshot []byte) (string, io.Reader) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	if meta != "" {
		part, err := w.CreateFormField("meta")
		if err != nil {
			t.Fatalf("meta part: %v", err)
		}
		if _, err := part.Write([]byte(meta)); err != nil {
			t.Fatalf("write meta: %v", err)
		}
	}
	if screenshot != nil {
		part, err := w.CreateFormFile("screenshot", "shot.png")
		if err != nil {
			t.Fatalf("screenshot part: %v", err)
		}
		if _, err := part.Write(screenshot); err != nil {
			t.Fatalf("write screenshot: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	return w.FormDataContentType(), &buf
}

func post(t *testing.T, h http.Handler, host, meta string, screenshot []byte) *httptest.ResponseRecorder {
	t.Helper()
	ct, body := multipartBody(t, meta, screenshot)
	req := httptest.NewRequest(http.MethodPost, "/_prevly/api/feedback", body)
	req.Host = host
	req.Header.Set("Content-Type", ct)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func get(t *testing.T, h http.Handler, host, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Host = host
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decodeItem(t *testing.T, body []byte) map[string]any {
	t.Helper()
	var out struct {
		Item map[string]any `json:"item"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("decode item: %v (%s)", err, body)
	}
	return out.Item
}

func TestListEmpty(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	rec := get(t, f.svc.PreviewHandler(), previewHost, "/_prevly/api/feedback")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != `{"items":[]}` {
		t.Fatalf("body = %s", got)
	}
	if rec.Header().Get("Cache-Control") != "no-store" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("missing API headers: %v", rec.Header())
	}
}

func TestCreateStoresPostsAndLists(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	h := f.svc.PreviewHandler()

	rec := post(t, h, previewHost, validMeta(), pngBytes())
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
	item := decodeItem(t, rec.Body.Bytes())
	id, _ := item["id"].(string)
	if !validID(id) {
		t.Fatalf("bad id %q", id)
	}
	if item["screenshot_url"] != "https://preview.example.com/_prevly/feedback/"+id+"/screenshot.png" {
		t.Fatalf("screenshot_url = %v", item["screenshot_url"])
	}
	if item["comment_url"] == nil {
		t.Fatal("comment_url must be set when the post succeeded")
	}
	if _, ok := item["console"]; ok {
		t.Fatal("console must not be returned by the API")
	}
	if _, ok := item["user_agent"]; ok {
		t.Fatal("userAgent must not be returned by the API")
	}

	stored, err := f.store.GetFeedback(id)
	if err != nil {
		t.Fatalf("stored record: %v", err)
	}
	if stored.Repo != "org/repo" || stored.PRNumber != 42 || stored.AppName != "web" || stored.Host != previewHost {
		t.Fatalf("record not bound to the preview: %+v", stored)
	}
	if stored.CommitSHA != "abc1234def" || len(stored.Console) != 1 || stored.UserAgent != "Mozilla/5.0" {
		t.Fatalf("record lost fields: %+v", stored)
	}
	if stored.CommentID == 0 {
		t.Fatal("record must remember the posted comment id")
	}

	if _, err := os.Stat(filepath.Join(f.dir, id+".png")); err != nil {
		t.Fatalf("screenshot file: %v", err)
	}

	body := f.gh.last()
	if !strings.Contains(body, commentMarker(id)) {
		t.Fatalf("comment body lacks the marker: %s", body)
	}
	if !strings.Contains(body, "https://preview.example.com/_prevly/feedback/"+id+"/screenshot.png") {
		t.Fatalf("comment body lacks the base-domain screenshot url: %s", body)
	}

	list := get(t, h, previewHost, "/_prevly/api/feedback")
	if list.Code != http.StatusOK {
		t.Fatalf("list status = %d", list.Code)
	}
	if !strings.Contains(list.Body.String(), id) {
		t.Fatalf("list does not contain the new report: %s", list.Body)
	}
}

func TestCreateWithoutScreenshot(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	rec := post(t, f.svc.PreviewHandler(), previewHost, validMeta(), nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
	item := decodeItem(t, rec.Body.Bytes())
	if item["screenshot_url"] != nil {
		t.Fatalf("screenshot_url = %v, want null", item["screenshot_url"])
	}
	if strings.Contains(f.gh.last(), "![screenshot]") {
		t.Fatal("comment must not embed an image when none was posted")
	}
}

func TestCreateRejectsBadInput(t *testing.T) {
	t.Parallel()
	big := strings.Repeat("x", maxComment+1)
	tests := []struct {
		name string
		meta string
		shot []byte
		want int
	}{
		{"missing meta", "", nil, http.StatusBadRequest},
		{"invalid json", "{", nil, http.StatusBadRequest},
		{"empty author", `{"author":"","comment":"c","page":"/"}`, nil, http.StatusBadRequest},
		{"long author", `{"author":"` + strings.Repeat("a", maxAuthor+1) + `","comment":"c","page":"/"}`, nil, http.StatusBadRequest},
		{"long comment", `{"author":"a","comment":"` + big + `","page":"/"}`, nil, http.StatusBadRequest},
		{"relative page", `{"author":"a","comment":"c","page":"reports"}`, nil, http.StatusBadRequest},
		{"too many console entries", `{"author":"a","comment":"c","page":"/","console":` + consoleJSON(maxConsole+1) + `}`, nil, http.StatusBadRequest},
		{"oversize meta", `{"author":"a","comment":"` + strings.Repeat("y", maxMetaBytes) + `","page":"/"}`, nil, http.StatusBadRequest},
		{"not a png", validMeta(), []byte("GIF89a and more"), http.StatusBadRequest},
		{"oversize screenshot", validMeta(), append(bytes.Clone(pngMagic), bytes.Repeat([]byte("z"), maxScreenshotBytes)...), http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newFixture(t, defaultConfig())
			rec := post(t, f.svc.PreviewHandler(), previewHost, tt.meta, tt.shot)
			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d (%s)", rec.Code, tt.want, rec.Body)
			}
			all, err := f.store.ListFeedback()
			if err != nil {
				t.Fatalf("list: %v", err)
			}
			if len(all) != 0 {
				t.Fatalf("a rejected report must not be stored: %+v", all)
			}
		})
	}
}

func consoleJSON(n int) string {
	entries := make([]string, 0, n)
	for range n {
		entries = append(entries, `{"level":"error","message":"m","at":"t"}`)
	}
	return "[" + strings.Join(entries, ",") + "]"
}

func TestCreateWrongContentType(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	req := httptest.NewRequest(http.MethodPost, "/_prevly/api/feedback", strings.NewReader("{}"))
	req.Host = previewHost
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	f.svc.PreviewHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestUnknownHostAndOptedOutRepo(t *testing.T) {
	t.Parallel()
	optedOut := livePreview()
	optedOut.FeedbackEnabled = boolPtr(false)
	f := newFixture(t, defaultConfig(), optedOut)
	h := f.svc.PreviewHandler()

	for _, host := range []string{"nobody.preview.example.com", previewHost} {
		if rec := get(t, h, host, "/_prevly/api/feedback"); rec.Code != http.StatusNotFound {
			t.Fatalf("GET on %s: status = %d, want 404", host, rec.Code)
		}
		if rec := post(t, h, host, validMeta(), nil); rec.Code != http.StatusNotFound {
			t.Fatalf("POST on %s: status = %d, want 404", host, rec.Code)
		}
	}
}

func TestUnknownPathIs404(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	if rec := get(t, f.svc.PreviewHandler(), previewHost, "/_prevly/nope"); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestRateLimit(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	cfg.MaxPerHour = 1
	f := newFixture(t, cfg)
	h := f.svc.PreviewHandler()

	if rec := post(t, h, previewHost, validMeta(), nil); rec.Code != http.StatusCreated {
		t.Fatalf("first post status = %d", rec.Code)
	}
	rec := post(t, h, previewHost, validMeta(), nil)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second post status = %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("429 must carry Retry-After")
	}
}

func TestPostFailureKeepsRecordForTick(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	f.gh.err = errors.New("github down")

	rec := post(t, f.svc.PreviewHandler(), previewHost, validMeta(), nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
	item := decodeItem(t, rec.Body.Bytes())
	if item["comment_url"] != nil {
		t.Fatalf("comment_url = %v, want null", item["comment_url"])
	}
	unposted, err := f.store.ListFeedbackUnposted()
	if err != nil {
		t.Fatalf("list unposted: %v", err)
	}
	if len(unposted) != 1 || unposted[0].PostAttempts != 1 {
		t.Fatalf("unexpected unposted set: %+v", unposted)
	}

	f.gh.mu.Lock()
	f.gh.err = nil
	f.gh.mu.Unlock()

	f.svc.Tick(context.Background())

	if f.gh.count() != 1 {
		t.Fatalf("tick posted %d comments, want 1", f.gh.count())
	}
	still, err := f.store.ListFeedbackUnposted()
	if err != nil {
		t.Fatalf("list unposted: %v", err)
	}
	if len(still) != 0 {
		t.Fatalf("report still unposted after a successful retry: %+v", still)
	}
}

func TestScreenshotServing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	rec := post(t, f.svc.PreviewHandler(), previewHost, validMeta(), pngBytes())
	id, _ := decodeItem(t, rec.Body.Bytes())["id"].(string)

	for name, h := range map[string]http.Handler{
		"preview": f.svc.PreviewHandler(),
		"control": f.svc.ControlHandler(),
	} {
		got := get(t, h, previewHost, "/_prevly/feedback/"+id+"/screenshot.png")
		if got.Code != http.StatusOK {
			t.Fatalf("%s: status = %d", name, got.Code)
		}
		if got.Header().Get("Content-Type") != "image/png" {
			t.Fatalf("%s: content-type = %q", name, got.Header().Get("Content-Type"))
		}
		if got.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
			t.Fatalf("%s: cache-control = %q", name, got.Header().Get("Cache-Control"))
		}
		missing := get(t, h, previewHost, "/_prevly/feedback/"+strings.Repeat("0", idLen)+"/screenshot.png")
		if missing.Code != http.StatusNotFound {
			t.Fatalf("%s: missing screenshot status = %d", name, missing.Code)
		}
		traversal := get(t, h, previewHost, "/_prevly/feedback/..%2f..%2fstate.db/screenshot.png")
		if traversal.Code != http.StatusNotFound {
			t.Fatalf("%s: traversal status = %d", name, traversal.Code)
		}
	}
}

func TestScriptServing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	for name, h := range map[string]http.Handler{
		"preview": f.svc.PreviewHandler(),
		"control": f.svc.ControlHandler(),
	} {
		rec := get(t, h, previewHost, "/_prevly/feedback.js")
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d", name, rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/javascript") {
			t.Fatalf("%s: content-type = %q", name, ct)
		}
		if rec.Header().Get("Cache-Control") != "no-cache" {
			t.Fatalf("%s: cache-control = %q", name, rec.Header().Get("Cache-Control"))
		}
		if rec.Body.Len() == 0 {
			t.Fatalf("%s: empty bundle", name)
		}
	}
}

func TestControlHandlerHasNoAPI(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	if rec := get(t, f.svc.ControlHandler(), "preview.example.com", "/_prevly/api/feedback"); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func boolPtr(b bool) *bool { return &b }

func TestActivateSetsCookieAndRedirects(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())

	rec := get(t, f.svc.PreviewHandler(), previewHost, "/_prevly/activate")
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	if got := rec.Header().Get("Location"); got != "/" {
		t.Fatalf("Location = %q", got)
	}
	var found *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == "prevly_feedback" {
			found = c
		}
	}
	if found == nil || found.Value != "1" || found.Path != "/" || found.MaxAge <= 0 {
		t.Fatalf("activation cookie = %+v", found)
	}
}

func TestActivateRedirectTargetStaysOnTheApp(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ in, want string }{
		{"/reports/12?tab=costs", "/reports/12?tab=costs"},
		{"//evil.example.com", "/"},
		{"https://evil.example.com", "/"},
		{"/_prevly/activate", "/"},
		{"", "/"},
	} {
		if got := redirectTarget(tc.in); got != tc.want {
			t.Fatalf("redirectTarget(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
