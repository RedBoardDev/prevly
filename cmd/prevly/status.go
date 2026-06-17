package main

import (
	"fmt"
	"sort"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"

	"github.com/RedBoardDev/prevly/internal/config"
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
			st, err := openStore(cfg)
			if err != nil {
				return err
			}
			defer st.Close()

			previews, err := st.List()
			if err != nil {
				return err
			}
			sort.Slice(previews, func(i, j int) bool {
				return previews[i].Key() < previews[j].Key()
			})

			w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 2, 2, ' ', 0)
			fmt.Fprintln(w, "REPO\tPR\tAPP\tSTATUS\tURL\tAGE\tLAST SEEN")
			now := time.Now()
			for _, p := range previews {
				fmt.Fprintf(w, "%s\t%d\t%s\t%s\t%s\t%s\t%s\n",
					p.Repo, p.PRNumber, p.AppName, p.Status, p.URL,
					age(now.Sub(p.CreatedAt)), age(now.Sub(p.LastSeenAt)))
			}
			return w.Flush()
		},
	}
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
