package github

import (
	"context"
	"errors"
	"io"
	"net/http"

	applog "github.com/RedBoardDev/prevly/internal/log"
)

// EventHandler receives parsed, signature-verified webhook events. The
// reconciler implements it. Handlers should return quickly (enqueue work) and
// not block on builds.
type EventHandler interface {
	HandlePullRequest(ctx context.Context, e *PullRequestEvent) error
	HandleIssueComment(ctx context.Context, e *IssueCommentEvent) error
}

// WebhookHandler is the HTTP handler for GitHub webhooks. It verifies the HMAC
// signature, parses the event, and dispatches to an EventHandler.
type WebhookHandler struct {
	secret  string
	handler EventHandler
	logger  *applog.Logger

	// maxBody guards against oversized payloads.
	maxBody int64
}

// NewWebhookHandler builds a WebhookHandler.
func NewWebhookHandler(secret string, handler EventHandler, logger *applog.Logger) *WebhookHandler {
	return &WebhookHandler{secret: secret, handler: handler, logger: logger, maxBody: 5 << 20}
}

func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, h.maxBody))
	if err != nil {
		http.Error(w, "read body", http.StatusBadRequest)
		return
	}
	if err := VerifySignature(h.secret, body, r.Header.Get("X-Hub-Signature-256")); err != nil {
		h.logger.Warn("rejected webhook with invalid signature", "err", err)
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	eventType := r.Header.Get("X-GitHub-Event")
	if err := h.dispatch(r.Context(), eventType, body); err != nil {
		if errors.Is(err, errIgnoredEvent) {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.logger.Error("handle webhook", "event", eventType, "err", err)
		http.Error(w, "handler error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

var errIgnoredEvent = errors.New("ignored event")

func (h *WebhookHandler) dispatch(ctx context.Context, eventType string, body []byte) error {
	switch eventType {
	case "pull_request":
		e, err := ParsePullRequest(body)
		if err != nil {
			return err
		}
		return h.handler.HandlePullRequest(ctx, e)
	case "issue_comment":
		e, err := ParseIssueComment(body)
		if err != nil {
			return err
		}
		return h.handler.HandleIssueComment(ctx, e)
	case "ping", "installation", "installation_repositories":
		h.logger.Debug("received informational webhook", "event", eventType)
		return errIgnoredEvent
	default:
		h.logger.Debug("ignoring unsupported webhook", "event", eventType)
		return errIgnoredEvent
	}
}
