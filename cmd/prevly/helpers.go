package main

import (
	"path/filepath"

	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/store"
)

// storePath returns the bbolt database path under the host data dir.
func storePath(cfg *config.HostConfig) string {
	return filepath.Join(cfg.DataDir, "state.db")
}

// openStore loads the host config and opens the state store.
func openStore(cfg *config.HostConfig) (*store.Store, error) {
	return store.Open(storePath(cfg))
}

// openStoreReadOnly opens the state store with a shared lock. It is only safe
// when the daemon is not running (the daemon holds the exclusive lock).
func openStoreReadOnly(cfg *config.HostConfig) (*store.Store, error) {
	return store.OpenReadOnly(storePath(cfg))
}
