package feedback

import (
	"context"
	"os"
	"strings"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
)

// maxPostAttempts caps the retries of a PR comment before the report is left
// stored but unposted.
const maxPostAttempts = 5

// Tick retries the PR comments that never landed and sweeps screenshot files
// past the retention window. Called once per reconcile interval.
func (s *Service) Tick(ctx context.Context) {
	s.retryComments(ctx)
	s.sweepScreenshots()
}

func (s *Service) retryComments(ctx context.Context) {
	pending, err := s.store.ListFeedbackUnposted()
	if err != nil {
		s.logger.Error("list unposted feedback", "err", err)
		return
	}
	for _, f := range pending {
		if f.PostAttempts >= maxPostAttempts || ctx.Err() != nil {
			continue
		}
		previewURL := "https://" + f.Host
		if p, err := s.store.Get(f.Repo, f.PRNumber, f.AppName); err == nil && p != nil && p.URL != "" {
			previewURL = p.URL
		}
		postCtx, cancel := context.WithTimeout(ctx, postTimeout)
		s.postComment(postCtx, f, previewURL)
		cancel()
	}
}

// postComment renders and posts the report's PR comment, then persists the
// outcome. A failure leaves CommentID at 0 so the next tick retries.
func (s *Service) postComment(ctx context.Context, f *model.Feedback, previewURL string) {
	owner, name, ok := strings.Cut(f.Repo, "/")
	if !ok || f.InstallationID == 0 {
		s.logger.Warn("feedback not postable", "id", f.ID, "repo", f.Repo)
		f.PostAttempts = maxPostAttempts
		s.persist(f)
		return
	}
	f.PostAttempts++
	id, url, err := s.gh.PostComment(ctx, f.InstallationID, owner, name, f.PRNumber, RenderComment(f, s.baseDomain, previewURL))
	if err != nil {
		s.logger.Warn("post feedback comment", "id", f.ID, "repo", f.Repo, "pr", f.PRNumber, "err", err)
		s.persist(f)
		return
	}
	f.CommentID = id
	f.CommentURL = url
	s.persist(f)
}

func (s *Service) persist(f *model.Feedback) {
	if err := s.store.PutFeedback(f); err != nil {
		s.logger.Error("persist feedback", "id", f.ID, "err", err)
	}
}

// sweepScreenshots deletes the image files whose report is older than the
// retention window, or gone (torn down) and whose file is that old.
func (s *Service) sweepScreenshots() {
	retention := s.cfg.Retention.Std()
	if retention <= 0 {
		return
	}
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if !os.IsNotExist(err) {
			s.logger.Warn("read feedback dir", "dir", s.dir, "err", err)
		}
		return
	}
	records, err := s.store.ListFeedback()
	if err != nil {
		s.logger.Error("list feedback for sweep", "err", err)
		return
	}
	created := make(map[string]time.Time, len(records))
	for _, f := range records {
		created[f.ID] = f.CreatedAt
	}

	cutoff := s.now().Add(-retention)
	for _, e := range entries {
		id, ok := strings.CutSuffix(e.Name(), ".png")
		if e.IsDir() || !ok || !validID(id) {
			continue
		}
		at, known := created[id]
		if !known {
			info, err := e.Info()
			if err != nil {
				continue
			}
			at = info.ModTime()
		}
		if at.After(cutoff) {
			continue
		}
		if err := os.Remove(s.screenshotPath(id)); err != nil && !os.IsNotExist(err) {
			s.logger.Warn("remove screenshot", "id", id, "err", err)
		}
	}
}
