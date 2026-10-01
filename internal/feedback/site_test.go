package feedback

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	gh "github.com/RedBoardDev/prevly/internal/github"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/store"
)

const siteTestKey = "unit-test-site-shared-secret-32-chars-min"

func stagingSite() config.SiteConfig {
	return config.SiteConfig{Name: "staging", Repo: "acme/shop", Labels: []string{"feedback/staging"}, IssueType: "Draft", KeyEnv: "K"}
}

func newSiteFixture(t *testing.T, site config.SiteConfig, logOut io.Writer) (*fixture, *fakeGitHub) {
	t.Helper()
	if logOut == nil {
		logOut = io.Discard
	}
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "state.db"))
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	fg := &fakeGitHub{}
	svc := New(Deps{
		Store:  st,
		GitHub: fg,
		Config: config.FeedbackConfig{
			Retention:  config.Duration(90 * 24 * time.Hour),
			MaxPerHour: 30,
			Sites:      []config.SiteConfig{site},
		},
		BaseDomain: "preview.example.com",
		DataDir:    dir,
		Logger:     applog.New(applog.Options{Level: "warn", Out: logOut}),
		SiteKeys:   map[string]string{site.Name: siteTestKey},
	})
	return &fixture{svc: svc, store: st, gh: fg, dir: filepath.Join(dir, "feedback")}, fg
}

func postSite(t *testing.T, h http.Handler, site, key, meta string, screenshot []byte) *httptest.ResponseRecorder {
	t.Helper()
	ct, body := multipartBody(t, meta, screenshot)
	req := httptest.NewRequest(http.MethodPost, "/_prevly/sites/"+site+"/api/feedback", body)
	req.Host = "preview.example.com"
	req.Header.Set("Content-Type", ct)
	if key != "" {
		req.Header.Set("X-Prevly-Site-Key", key)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// TestSiteRouteAuthAnswersIdenticalNotFound proves an unknown site, a missing
// key and a wrong key all answer the same 404 as any unknown path, so the
// endpoint reveals nothing to a guess.
func TestSiteRouteAuthAnswersIdenticalNotFound(t *testing.T) {
	t.Parallel()
	f, fg := newSiteFixture(t, stagingSite(), nil)
	h := f.svc.ControlHandler()

	cases := map[string]*httptest.ResponseRecorder{
		"unknown site": postSite(t, h, "nope", siteTestKey, validMeta(), nil),
		"missing key":  postSite(t, h, "staging", "", validMeta(), nil),
		"wrong key":    postSite(t, h, "staging", "wrong-key-wrong-key-wrong-key-32c", validMeta(), nil),
	}
	plain := httptest.NewRecorder()
	h.ServeHTTP(plain, httptest.NewRequest(http.MethodGet, "/_prevly/does-not-exist", nil))

	for name, rec := range cases {
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want 404", name, rec.Code)
		}
		if rec.Body.String() != plain.Body.String() {
			t.Errorf("%s: body = %q, want identical to an unknown path: %q", name, rec.Body.String(), plain.Body.String())
		}
	}
	if fg.issueCount() != 0 {
		t.Fatal("an unauthorized post must never create an issue")
	}
}

// TestSiteRouteGETAnswers404 proves GET on the site path is 404, not 401: a
// site has no pin list, which the widget contract reads as "no pins, not
// locked".
func TestSiteRouteGETAnswers404(t *testing.T) {
	t.Parallel()
	f, _ := newSiteFixture(t, stagingSite(), nil)
	req := httptest.NewRequest(http.MethodGet, "/_prevly/sites/staging/api/feedback", nil)
	req.Header.Set("X-Prevly-Site-Key", siteTestKey)
	rec := httptest.NewRecorder()
	f.svc.ControlHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

// TestSiteReportCreatesIssueWithLabelsAndType drives the full happy path
// through ControlHandler: the stored record, the issue's labels and type, and
// the response shape.
func TestSiteReportCreatesIssueWithLabelsAndType(t *testing.T) {
	t.Parallel()
	f, fg := newSiteFixture(t, stagingSite(), nil)
	h := f.svc.ControlHandler()

	rec := postSite(t, h, "staging", siteTestKey, validMeta(), pngBytes())
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
	item := decodeItem(t, rec.Body.Bytes())
	id, _ := item["id"].(string)
	if !validID(id) {
		t.Fatalf("bad id %q", id)
	}
	if item["site"] != "staging" {
		t.Fatalf("site = %v", item["site"])
	}

	stored, err := f.store.GetFeedback(id)
	if err != nil {
		t.Fatalf("stored record: %v", err)
	}
	if stored.Site != "staging" || stored.IssueNumber == 0 || stored.IssueURL == "" {
		t.Fatalf("record not posted: %+v", stored)
	}
	if item["comment_url"] != stored.IssueURL {
		t.Fatalf("comment_url = %v, want the created issue's URL %q so the reviewer gets a link to what they filed", item["comment_url"], stored.IssueURL)
	}

	if fg.issueCount() != 1 {
		t.Fatalf("issues created = %d, want 1", fg.issueCount())
	}
	report := fg.lastIssue()
	if report.Type != "Draft" {
		t.Fatalf("type = %q, want the site's configured issue_type", report.Type)
	}
	if len(report.Labels) != 1 || report.Labels[0] != "feedback/staging" {
		t.Fatalf("labels = %+v, want only the site's labels: the type rides in the title unless type_label is set", report.Labels)
	}
	if !strings.HasPrefix(report.Title, "Bug: ") {
		t.Fatalf("title = %q, want the report type in front", report.Title)
	}
	if !strings.Contains(report.Body, siteIssueMarker(id)) {
		t.Fatalf("body missing idempotency marker:\n%s", report.Body)
	}
}

// TestSiteReportMakesReviewerTextInert proves an @mention, a bare issue
// reference, a GH-<digits> shorthand and a markdown image are all made inert
// before they reach the issue, and that < and > are escaped.
func TestSiteReportMakesReviewerTextInert(t *testing.T) {
	t.Parallel()
	f, fg := newSiteFixture(t, stagingSite(), nil)
	h := f.svc.ControlHandler()

	meta := `{"author":"@octocat","comment":"see #123 and GH-456 owner/repo#789 ![x](y) <script> reviewer text","page":"/x"}`
	rec := postSite(t, h, "staging", siteTestKey, meta, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}

	report := fg.lastIssue()
	if strings.Contains(report.Body, "@octocat") {
		t.Fatalf("mention not neutralised:\n%s", report.Body)
	}
	if strings.Contains(report.Body, "#123") || strings.Contains(report.Body, "GH-456") {
		t.Fatalf("issue reference not neutralised:\n%s", report.Body)
	}
	if strings.Contains(report.Body, "![x]") {
		t.Fatalf("image markdown not neutralised:\n%s", report.Body)
	}
	if strings.Contains(report.Body, "<script>") {
		t.Fatalf("< and > not escaped:\n%s", report.Body)
	}
	if strings.Contains(report.Title, "@octocat") {
		t.Fatalf("title not neutralised: %q", report.Title)
	}
}

// TestSiteReportLogsSilentlyDroppedLabelsAndType proves a dropped label or
// type is logged with the likely cause, and does not fail the report.
func TestSiteReportLogsSilentlyDroppedLabelsAndType(t *testing.T) {
	t.Parallel()
	var logs strings.Builder
	f, fg := newSiteFixture(t, stagingSite(), &logs)
	fg.issueOnce = gh.CreateIssueResult{Number: 3, URL: "https://github.com/acme/shop/issues/3", MissingLabels: []string{"feedback/staging"}, TypeDropped: true}
	h := f.svc.ControlHandler()

	rec := postSite(t, h, "staging", siteTestKey, validMeta(), nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
	if !strings.Contains(logs.String(), "labels silently dropped") || !strings.Contains(logs.String(), "issue type silently dropped") {
		t.Fatalf("silent drops not logged:\n%s", logs.String())
	}

	item := decodeItem(t, rec.Body.Bytes())
	if item["comment_url"] != "https://github.com/acme/shop/issues/3" {
		t.Fatalf("comment_url = %v, want the issue's URL even when some of its labels/type were dropped", item["comment_url"])
	}
}

// TestSiteReportRateLimited proves the per-host limiter also gates a site,
// keyed separately from any preview host.
func TestSiteReportRateLimited(t *testing.T) {
	t.Parallel()
	site := stagingSite()
	f, _ := newSiteFixture(t, site, nil)
	f.svc.limiter = newLimiter(1, f.svc.now)
	h := f.svc.ControlHandler()

	if rec := postSite(t, h, "staging", siteTestKey, validMeta(), nil); rec.Code != http.StatusCreated {
		t.Fatalf("first post: status = %d", rec.Code)
	}
	rec := postSite(t, h, "staging", siteTestKey, validMeta(), nil)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second post: status = %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("missing Retry-After")
	}
}

// TestSiteRetentionSweepDeletesExpiredRecords proves a site report has no
// teardown to rely on: the tick itself deletes the record and its screenshot
// past retention.
func TestSiteRetentionSweepDeletesExpiredRecords(t *testing.T) {
	t.Parallel()
	f, _ := newSiteFixture(t, stagingSite(), nil)

	old := &model.Feedback{ID: mustID(t), Site: "staging", Page: "/x", Author: "a", Comment: "c",
		CreatedAt: time.Now().Add(-91 * 24 * time.Hour), HasScreenshot: true, IssueNumber: 1}
	if err := f.store.PutFeedback(old); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := os.MkdirAll(f.dir, 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	shotPath := filepath.Join(f.dir, old.ID+".png")
	if err := os.WriteFile(shotPath, pngBytes(), 0o600); err != nil {
		t.Fatalf("write screenshot: %v", err)
	}

	f.svc.Tick(context.Background())

	if _, err := f.store.GetFeedback(old.ID); err == nil {
		t.Fatal("expired site record must be deleted")
	}
	if _, err := os.Stat(shotPath); !os.IsNotExist(err) {
		t.Fatalf("expired screenshot must be removed: err = %v", err)
	}
}

func mustID(t *testing.T) string {
	t.Helper()
	id, err := NewID(time.Now())
	if err != nil {
		t.Fatalf("new id: %v", err)
	}
	return id
}

func TestSiteReportAddsTheTypeLabelWhenAsked(t *testing.T) {
	t.Parallel()
	site := stagingSite()
	site.TypeLabel = true
	f, fg := newSiteFixture(t, site, nil)

	rec := postSite(t, f.svc.ControlHandler(), "staging", siteTestKey, validMeta(), nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
	}
	labels := fg.lastIssue().Labels
	if len(labels) != 2 || labels[1] != "bug" {
		t.Fatalf("labels = %+v, want the site's labels then the report type", labels)
	}
}
