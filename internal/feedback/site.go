package feedback

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	gh "github.com/RedBoardDev/prevly/internal/github"
	"github.com/RedBoardDev/prevly/internal/model"
)

// minSiteKeyLen is the shortest shared secret ResolveSiteKeys accepts.
const minSiteKeyLen = 32

// ResolveSiteKeys reads each configured site's shared secret from its own env
// var, once at daemon start. A missing or too-short value is a fatal error
// naming the variable, never the value.
func ResolveSiteKeys(sites []config.SiteConfig, lookup func(string) string) (map[string]string, error) {
	keys := make(map[string]string, len(sites))
	for _, s := range sites {
		v := lookup(s.KeyEnv)
		if len(v) < minSiteKeyLen {
			return nil, fmt.Errorf("feedback site %q: env %s must hold a secret of at least %d characters", s.Name, s.KeyEnv, minSiteKeyLen)
		}
		keys[s.Name] = v
	}
	return keys, nil
}

// siteConfig pairs one configured site with its resolved secret.
type siteConfig struct {
	cfg config.SiteConfig
	key string
}

// createSiteReport answers POST /_prevly/sites/{site}/api/feedback. An
// unknown site and a missing or wrong key both answer 404, identical to any
// other unknown path, so the endpoint reveals nothing to a guess.
func (s *Service) createSiteReport(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("site")
	site, ok := s.sites[name]
	if !ok {
		notFound(w, r)
		return
	}
	if !validToken(r.Header.Get("X-Prevly-Site-Key"), site.key) {
		s.logger.Warn("wrong or missing site feedback key", "site", name)
		notFound(w, r)
		return
	}
	if allowed, retry := s.limiter.allow("site:" + name); !allowed {
		w.Header().Set("Retry-After", strconv.Itoa(int(retry.Round(time.Second)/time.Second)))
		writeError(w, http.StatusTooManyRequests, "too many reports for this site")
		return
	}
	if !isMultipart(r) {
		writeError(w, http.StatusUnsupportedMediaType, "expected multipart/form-data")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	m, shot, err := readParts(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := m.validate(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	id, err := NewID(s.now())
	if err != nil {
		s.logger.Error("feedback id", "err", err)
		writeError(w, http.StatusInternalServerError, "id error")
		return
	}
	if len(shot) > 0 {
		if err := s.saveScreenshot(id, shot); err != nil {
			s.logger.Error("save screenshot", "id", id, "err", err)
			writeError(w, http.StatusInternalServerError, "screenshot error")
			return
		}
	}

	f := m.siteRecord(id, name, s.now().UTC(), len(shot) > 0)
	// Store before posting, exactly as a preview report does: a failed or slow
	// GitHub must leave a record the reconcile tick can retry.
	if err := s.store.PutFeedback(f); err != nil {
		s.logger.Error("store site feedback", "id", id, "err", err)
		writeError(w, http.StatusInternalServerError, "store error")
		return
	}

	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), postTimeout)
	defer cancel()
	s.postSiteIssue(ctx, f, site.cfg)

	writeJSON(w, http.StatusCreated, map[string]any{"item": s.toJSON(f)})
}

func (m *meta) siteRecord(id, site string, now time.Time, hasScreenshot bool) *model.Feedback {
	return &model.Feedback{
		ID:            id,
		Site:          site,
		Type:          m.Type,
		Page:          m.Page,
		Author:        m.Author,
		Comment:       m.Comment,
		Title:         m.Title,
		Selector:      m.Selector,
		Element:       m.Element,
		Click:         m.Click,
		Rect:          m.Rect,
		Viewport:      m.Viewport,
		CreatedAt:     now,
		Client:        m.Client,
		Console:       m.Console,
		Context:       m.Context,
		Network:       m.Network,
		HasScreenshot: hasScreenshot,
	}
}

// postSiteIssue turns a stored site report into a GitHub issue and persists
// the outcome. A failure leaves IssueNumber at 0 so the next tick retries.
func (s *Service) postSiteIssue(ctx context.Context, f *model.Feedback, site config.SiteConfig) {
	owner, name, ok := strings.Cut(site.Repo, "/")
	if !ok {
		s.logger.Warn("site report not postable: bad repo", "site", f.Site, "repo", site.Repo)
		f.PostAttempts = maxPostAttempts
		s.persist(f)
		return
	}

	installationID, err := s.installationFor(ctx, owner, name)
	if err != nil {
		s.logger.Warn("find installation for site", "site", f.Site, "repo", site.Repo, "err", err)
		f.PostAttempts++
		s.persist(f)
		return
	}

	title, body := RenderSiteIssue(f, f.Site, s.baseDomain)
	labels := append(append([]string{}, site.Labels...), f.Type)
	report := gh.SiteReport{Title: title, Body: body, Labels: labels, Type: site.IssueType}

	f.PostAttempts++
	result, err := s.gh.CreateSiteIssue(ctx, installationID, owner, name, siteIssueMarker(f.ID), f.CreatedAt, report)
	if err != nil {
		s.logger.Warn("create site issue", "id", f.ID, "site", f.Site, "repo", site.Repo, "err", err)
		s.persist(f)
		return
	}
	if result.RetriedWithoutType {
		s.logger.Warn("issue type rejected by github, retried without it", "id", f.ID, "site", f.Site, "type", report.Type)
	}
	if len(result.MissingLabels) > 0 {
		s.logger.Error("labels silently dropped creating the issue: the app likely lacks push access on the repo",
			"id", f.ID, "site", f.Site, "repo", site.Repo, "missing", result.MissingLabels)
	}
	if result.TypeDropped {
		s.logger.Error("issue type silently dropped creating the issue: the app likely lacks push access on the repo",
			"id", f.ID, "site", f.Site, "repo", site.Repo, "type", report.Type)
	}
	f.IssueNumber = int64(result.Number)
	f.IssueURL = result.URL
	s.persist(f)
}

// installationFor resolves and caches which installation covers owner/name,
// looked up through the App JWT the first time a site's repo is seen.
func (s *Service) installationFor(ctx context.Context, owner, name string) (int64, error) {
	key := owner + "/" + name
	s.instMu.Lock()
	id, cached := s.instCache[key]
	s.instMu.Unlock()
	if cached {
		return id, nil
	}
	id, err := s.gh.FindInstallation(ctx, owner, name)
	if err != nil {
		return 0, err
	}
	s.instMu.Lock()
	s.instCache[key] = id
	s.instMu.Unlock()
	return id, nil
}
