package store

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"

	bolt "go.etcd.io/bbolt"

	"github.com/RedBoardDev/prevly/internal/model"
)

// ErrFeedbackNotFound is returned when a feedback id does not exist.
var ErrFeedbackNotFound = errors.New("feedback not found")

// PutFeedback inserts or replaces a feedback record.
func (s *Store) PutFeedback(f *model.Feedback) error {
	data, err := json.Marshal(f)
	if err != nil {
		return fmt.Errorf("marshal feedback: %w", err)
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(feedbackBucket).Put([]byte(f.Key()), data)
	})
}

// GetFeedback fetches a record by its id. Returns ErrFeedbackNotFound if absent.
func (s *Store) GetFeedback(id string) (*model.Feedback, error) {
	suffix := []byte("#" + id)
	var found *model.Feedback
	err := s.eachFeedback(func(key []byte, f *model.Feedback) bool {
		if bytes.HasSuffix(key, suffix) {
			found = f
			return false
		}
		return true
	})
	if err != nil {
		return nil, err
	}
	if found == nil {
		return nil, ErrFeedbackNotFound
	}
	return found, nil
}

// ListFeedback returns every feedback record, oldest first.
func (s *Store) ListFeedback() ([]*model.Feedback, error) {
	return s.listFeedback(func(*model.Feedback) bool { return true })
}

// ListFeedbackByHost returns the records reported on a preview host, newest first.
func (s *Store) ListFeedbackByHost(host string) ([]*model.Feedback, error) {
	out, err := s.listFeedback(func(f *model.Feedback) bool { return f.Host == host })
	if err != nil {
		return nil, err
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}

// ListFeedbackUnposted returns the records whose PR comment was never created.
func (s *Store) ListFeedbackUnposted() ([]*model.Feedback, error) {
	return s.listFeedback(func(f *model.Feedback) bool { return f.CommentID == 0 })
}

// DeleteFeedbackByPreview removes every record of one preview. Screenshot files
// are left on disk for the retention sweep.
func (s *Store) DeleteFeedbackByPreview(repo string, pr int, app string) error {
	prefix := []byte(model.FeedbackPreviewPrefix(repo, pr, app))
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(feedbackBucket)
		if b == nil {
			return nil
		}
		c := b.Cursor()
		var keys [][]byte
		for k, _ := c.Seek(prefix); k != nil && bytes.HasPrefix(k, prefix); k, _ = c.Next() {
			keys = append(keys, bytes.Clone(k))
		}
		for _, k := range keys {
			if err := b.Delete(k); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) listFeedback(keep func(*model.Feedback) bool) ([]*model.Feedback, error) {
	var out []*model.Feedback
	err := s.eachFeedback(func(_ []byte, f *model.Feedback) bool {
		if keep(f) {
			out = append(out, f)
		}
		return true
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) eachFeedback(visit func(key []byte, f *model.Feedback) bool) error {
	return s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(feedbackBucket)
		if b == nil {
			return nil
		}
		c := b.Cursor()
		for k, v := c.First(); k != nil; k, v = c.Next() {
			var f model.Feedback
			if err := json.Unmarshal(v, &f); err != nil {
				return err
			}
			if !visit(k, &f) {
				return nil
			}
		}
		return nil
	})
}
