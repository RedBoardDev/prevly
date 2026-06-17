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
