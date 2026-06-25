// Package store persists Preview records in an embedded bbolt database. The
// store is the source of truth for routing and for the reconciler.
package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	bolt "go.etcd.io/bbolt"

	"github.com/RedBoardDev/prevly/internal/model"
)

// ErrNotFound is returned when a preview key does not exist.
var ErrNotFound = errors.New("preview not found")

var previewsBucket = []byte("previews")

// Store is a bbolt-backed Preview repository. It is safe for concurrent use.
type Store struct {
	db *bolt.DB
}

// Open opens (creating if needed) the bbolt database at path. It takes the
// exclusive file lock, so only one process (the daemon) may hold it at a time.
func Open(path string) (*Store, error) {
	db, err := bolt.Open(path, 0o600, &bolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("open store: %w", err)
	}
	err = db.Update(func(tx *bolt.Tx) error {
		_, e := tx.CreateBucketIfNotExists(previewsBucket)
		return e
	})
	if err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("init store: %w", err)
	}
	return &Store{db: db}, nil
}

// OpenReadOnly opens the database with a shared lock for read-only access. It
// is used by CLI commands as a fallback when the daemon is not running: the
// daemon holds the exclusive lock while up, so this only succeeds when no
// writer is active. Read methods (Get/List/...) work; writes are rejected by
// bbolt. The bucket must already exist (the daemon creates it on first run).
func OpenReadOnly(path string) (*Store, error) {
	db, err := bolt.Open(path, 0o600, &bolt.Options{Timeout: 5 * time.Second, ReadOnly: true})
	if err != nil {
		return nil, fmt.Errorf("open store: %w", err)
	}
	return &Store{db: db}, nil
}

// Close releases the database file.
func (s *Store) Close() error { return s.db.Close() }

// Put inserts or replaces a preview record.
func (s *Store) Put(p *model.Preview) error {
	data, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal preview: %w", err)
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(previewsBucket).Put([]byte(p.Key()), data)
	})
}

// Get fetches a preview by its components. Returns ErrNotFound if absent.
func (s *Store) Get(repo string, pr int, app string) (*model.Preview, error) {
	return s.getByKey(model.PreviewKey(repo, pr, app))
}

func (s *Store) getByKey(key string) (*model.Preview, error) {
	var p model.Preview
	err := s.db.View(func(tx *bolt.Tx) error {
		v := tx.Bucket(previewsBucket).Get([]byte(key))
		if v == nil {
			return ErrNotFound
		}
		return json.Unmarshal(v, &p)
	})
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// Delete removes a preview record. Missing keys are not an error.
func (s *Store) Delete(repo string, pr int, app string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(previewsBucket).Delete([]byte(model.PreviewKey(repo, pr, app)))
	})
}

// List returns all preview records.
func (s *Store) List() ([]*model.Preview, error) {
	return s.list(func(*model.Preview) bool { return true })
}

// ListByPR returns previews for a specific repo + PR number.
func (s *Store) ListByPR(repo string, pr int) ([]*model.Preview, error) {
	return s.list(func(p *model.Preview) bool {
		return p.Repo == repo && p.PRNumber == pr
	})
}

// ListByHost returns the preview routed by the given host, or ErrNotFound.
func (s *Store) ListByHost(host string) (*model.Preview, error) {
	previews, err := s.list(func(p *model.Preview) bool { return p.Host == host })
	if err != nil {
		return nil, err
	}
	if len(previews) == 0 {
		return nil, ErrNotFound
	}
	return previews[0], nil
}

func (s *Store) list(keep func(*model.Preview) bool) ([]*model.Preview, error) {
	var out []*model.Preview
	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(previewsBucket)
		if b == nil {
			// Bucket absent: a read-only open of a DB the daemon has never
			// initialized. Treat as empty rather than panicking.
			return nil
		}
		return b.ForEach(func(_, v []byte) error {
			var p model.Preview
			if err := json.Unmarshal(v, &p); err != nil {
				return err
			}
			if keep(&p) {
				out = append(out, &p)
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
