package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/statusapi"
)

func newStatusCmd(g *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "List all previews across repos (state, URL, age, last seen)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, err := config.LoadHostConfig(g.configPath)
			if err != nil {
				return err
			}
			previews, err := loadPreviews(cmd.Context(), cfg)
			if err != nil {
				return err
			}
			return renderStatus(cmd.OutOrStdout(), previews, time.Now())
		},
	}
}

// loadPreviews fetches previews from the running daemon over its status socket,
// falling back to a direct read-only store open when the daemon is down. The
// daemon holds the store's exclusive lock while up, so a direct open would
// otherwise time out — querying the socket is what keeps `status` usable.
func loadPreviews(ctx context.Context, cfg *config.HostConfig) ([]*model.Preview, error) {
	previews, err := statusapi.Query(ctx, cfg.DataDir)
	if err == nil {
		return previews, nil
	}
	if !errors.Is(err, statusapi.ErrDaemonNotRunning) {
		return nil, err
	}
	// Daemon not running: the store is unlocked, so a read-only open is safe.
	// If the store file does not exist yet (daemon never ran), there are simply
	// no previews — report an empty list rather than a confusing open error.
	if info, serr := os.Stat(storePath(cfg)); errors.Is(serr, os.ErrNotExist) || (serr == nil && info.Size() == 0) {
		return nil, nil
	}
	st, err := openStoreReadOnly(cfg)
	if err != nil {
		return nil, err
	}
	defer st.Close()
	return st.List()
}

func renderStatus(out io.Writer, previews []*model.Preview, now time.Time) error {
	sort.Slice(previews, func(i, j int) bool {
		return previews[i].Key() < previews[j].Key()
	})

	w := tabwriter.NewWriter(out, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "REPO\tPR\tAPP\tSTATUS\tURL\tAGE\tLAST SEEN")
	for _, p := range previews {
		fmt.Fprintf(w, "%s\t%d\t%s\t%s\t%s\t%s\t%s\n",
			p.Repo, p.PRNumber, p.AppName, p.Status, p.URL,
			age(now.Sub(p.CreatedAt)), age(now.Sub(p.LastSeenAt)))
	}
	return w.Flush()
}

func age(d time.Duration) string {
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	}
}
