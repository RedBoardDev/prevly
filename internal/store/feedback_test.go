package store

import (
	"errors"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
)

func feedback(id, host string, pr int, at time.Time) *model.Feedback {
	return &model.Feedback{
		ID: id, Repo: "org/a", PRNumber: pr, AppName: "web",
		Host: host, Page: "/", Author: "t", Comment: "c", CreatedAt: at,
	}
}

func TestFeedbackPutGetDelete(t *testing.T) {
	t.Parallel()
	st := newTestStore(t)
	now := time.Now().UTC()

	if err := st.PutFeedback(feedback("0001", "pr-1.x", 1, now)); err != nil {
		t.Fatalf("put: %v", err)
	}
	got, err := st.GetFeedback("0001")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Host != "pr-1.x" || got.Author != "t" {
		t.Fatalf("round-trip mismatch: %+v", got)
	}

	if _, err := st.GetFeedback("nope"); !errors.Is(err, ErrFeedbackNotFound) {
		t.Fatalf("expected ErrFeedbackNotFound, got %v", err)
	}

	if err := st.DeleteFeedbackByPreview("org/a", 1, "web"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := st.GetFeedback("0001"); !errors.Is(err, ErrFeedbackNotFound) {
		t.Fatalf("expected ErrFeedbackNotFound after delete, got %v", err)
	}
}

func TestDeleteFeedbackByPreviewSpareOthers(t *testing.T) {
	t.Parallel()
	st := newTestStore(t)
	now := time.Now().UTC()
	for _, f := range []*model.Feedback{
		feedback("0001", "pr-1.x", 1, now),
		feedback("0002", "pr-1.x", 1, now),
		feedback("0003", "pr-2.x", 2, now),
	} {
		if err := st.PutFeedback(f); err != nil {
			t.Fatalf("put: %v", err)
		}
	}

	if err := st.DeleteFeedbackByPreview("org/a", 1, "web"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	all, err := st.ListFeedback()
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(all) != 1 || all[0].ID != "0003" {
		t.Fatalf("unexpected survivors: %+v", all)
	}
}

func TestListFeedbackByHostNewestFirst(t *testing.T) {
	t.Parallel()
	st := newTestStore(t)
	now := time.Now().UTC()
	for _, f := range []*model.Feedback{
		feedback("0001", "pr-1.x", 1, now.Add(-2*time.Hour)),
		feedback("0002", "pr-1.x", 1, now.Add(-time.Hour)),
		feedback("0003", "pr-2.x", 2, now),
	} {
		if err := st.PutFeedback(f); err != nil {
			t.Fatalf("put: %v", err)
		}
	}

	got, err := st.ListFeedbackByHost("pr-1.x")
	if err != nil {
		t.Fatalf("list by host: %v", err)
	}
	if len(got) != 2 || got[0].ID != "0002" || got[1].ID != "0001" {
		t.Fatalf("want newest first, got %+v", got)
	}

	empty, err := st.ListFeedbackByHost("nobody.x")
	if err != nil {
		t.Fatalf("list by unknown host: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("want no records, got %d", len(empty))
	}
}

func TestListFeedbackUnposted(t *testing.T) {
	t.Parallel()
	st := newTestStore(t)
	now := time.Now().UTC()
	posted := feedback("0001", "pr-1.x", 1, now)
	posted.CommentID = 42
	if err := st.PutFeedback(posted); err != nil {
		t.Fatalf("put: %v", err)
	}
	if err := st.PutFeedback(feedback("0002", "pr-1.x", 1, now)); err != nil {
		t.Fatalf("put: %v", err)
	}

	got, err := st.ListFeedbackUnposted()
	if err != nil {
		t.Fatalf("list unposted: %v", err)
	}
	if len(got) != 1 || got[0].ID != "0002" {
		t.Fatalf("unexpected unposted set: %+v", got)
	}
}
