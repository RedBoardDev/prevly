// Package feedback serves the in-preview reviewer widget: it injects the
// widget script into proxied HTML, answers the /_prevly/ API on preview hosts,
// stores each report and mirrors it as a comment on the pull request.
package feedback

import (
	"context"
	"path/filepath"
	"strings"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/store"
)

// scriptTag is injected before </body> of every proxied HTML page of a preview
// whose repo opted in. The widget stays dormant until activated.
const scriptTag = `<script src="/_prevly/feedback.js" defer></script>`

// activationCookie is set by /_prevly/activate and read by the widget. It is
// deliberately readable from JavaScript: the widget clears it when the reviewer
// hides the widget.
const activationCookie = "prevly_feedback"

// activationTTL is how long a reviewer stays activated on a preview host.
const activationTTL = 90 * 24 * time.Hour

// GitHub is the subset of the GitHub App the feedback service needs.
type GitHub interface {
	PostComment(ctx context.Context, installationID int64, owner, repo string, pr int, body string) (id int64, url string, err error)
}

// Deps are the service's collaborators.
type Deps struct {
	Store      *store.Store
	GitHub     GitHub
	Config     config.FeedbackConfig
	BaseDomain string
	DataDir    string
	Logger     *applog.Logger
	Now        func() time.Time
}

// Service implements ingress.Injector and serves the feedback endpoints.
type Service struct {
	store      *store.Store
	gh         GitHub
	cfg        config.FeedbackConfig
	baseDomain string
	dir        string
	logger     *applog.Logger
	now        func() time.Time
	limiter    *limiter
}

// New builds a Service. Screenshots live under <DataDir>/feedback.
func New(d Deps) *Service {
	now := d.Now
	if now == nil {
		now = time.Now
	}
	return &Service{
		store:      d.Store,
		gh:         d.GitHub,
		cfg:        d.Config,
		baseDomain: d.BaseDomain,
		dir:        filepath.Join(d.DataDir, "feedback"),
		logger:     d.Logger,
		now:        now,
		limiter:    newLimiter(d.Config.MaxPerHour, now),
	}
}

// InjectTag returns the widget script tag for a host serving a live preview of
// a repo that opted in. It implements ingress.Injector.
func (s *Service) InjectTag(host string) (string, bool) {
	if !s.cfg.On() {
		return "", false
	}
	p, err := s.store.ListByHost(hostOnly(host))
	if err != nil || p == nil {
		return "", false
	}
	if !p.FeedbackOn() {
		return "", false
	}
	if p.Status != model.StatusRunning && p.Status != model.StatusSleeping {
		return "", false
	}
	return scriptTag, true
}

// OnTeardown drops the feedback records of a destroyed preview. Screenshot
// files are kept until the retention sweep so posted PR comments keep rendering.
func (s *Service) OnTeardown(repo string, pr int, app string) error {
	return s.store.DeleteFeedbackByPreview(repo, pr, app)
}

// screenshotURL is where GitHub fetches a report's image: always the base
// domain, so the image outlives the preview host.
func (s *Service) screenshotURL(id string) string {
	return "https://" + s.baseDomain + "/_prevly/feedback/" + id + "/screenshot.png"
}

func (s *Service) screenshotPath(id string) string {
	return filepath.Join(s.dir, id+".png")
}

// hostOnly strips an optional port from a Host header value.
func hostOnly(host string) string {
	if i := strings.LastIndexByte(host, ':'); i != -1 && !strings.Contains(host[i:], "]") {
		return host[:i]
	}
	return host
}
