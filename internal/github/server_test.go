package github

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	applog "github.com/RedBoardDev/prevly/internal/log"
)

type captureHandler struct {
	pr      *PullRequestEvent
	comment *IssueCommentEvent
}

func (c *captureHandler) HandlePullRequest(_ context.Context, e *PullRequestEvent) error {
	c.pr = e
	return nil
}

func (c *captureHandler) HandleIssueComment(_ context.Context, e *IssueCommentEvent) error {
	c.comment = e
	return nil
}

func testLogger() *applog.Logger {
	return applog.New(applog.Options{Level: "error", Out: io.Discard})
}

func post(t *testing.T, h http.Handler, secret, event, body string, sigOverride *string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(body))
	req.Header.Set("X-GitHub-Event", event)
	sig := sign(secret, []byte(body))
	if sigOverride != nil {
		sig = *sigOverride
	}
	req.Header.Set("X-Hub-Signature-256", sig)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestWebhookHandlerDispatch(t *testing.T) {
	t.Parallel()
	secret := "s3cr3t"
	cap := &captureHandler{}
	h := NewWebhookHandler(secret, cap, testLogger())

	rec := post(t, h, secret, "pull_request", prPayload, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if cap.pr == nil || cap.pr.Number != 42 {
		t.Fatalf("pull_request not dispatched: %+v", cap.pr)
	}

	rec = post(t, h, secret, "issue_comment", commentPayload, nil)
	if rec.Code != http.StatusOK || cap.comment == nil || cap.comment.Number != 42 {
		t.Fatalf("issue_comment not dispatched: code=%d %+v", rec.Code, cap.comment)
	}
}

func TestWebhookHandlerRejectsBadSignature(t *testing.T) {
	t.Parallel()
	secret := "s3cr3t"
	cap := &captureHandler{}
	h := NewWebhookHandler(secret, cap, testLogger())

	bad := "sha256=deadbeef"
	rec := post(t, h, secret, "pull_request", prPayload, &bad)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if cap.pr != nil {
		t.Fatal("handler must not run on bad signature")
	}
}

func TestWebhookHandlerIgnoresUnknownEvents(t *testing.T) {
	t.Parallel()
	secret := "s3cr3t"
	h := NewWebhookHandler(secret, &captureHandler{}, testLogger())
	rec := post(t, h, secret, "ping", `{}`, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("ping should be 200, got %d", rec.Code)
	}
}
