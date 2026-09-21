package feedback

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/RedBoardDev/prevly/internal/model"
)

// commentMarker prefixes the PR comment of a report so it is identifiable
// without being prevly's sticky marker.
func commentMarker(id string) string { return "<!-- prevly-feedback:" + id + " -->" }

// RenderComment renders the pull request comment body for one report. Pure, so
// the exact markdown is unit-tested.
func RenderComment(f *model.Feedback, baseDomain, previewURL string) string {
	var b strings.Builder
	b.WriteString(commentMarker(f.ID) + "\n")
	fmt.Fprintf(&b, "### 💬 Feedback on `%s` · [%s](<%s>)\n\n",
		sanitize(f.AppName), sanitize(f.Page), previewURL+f.Page)
	b.WriteString(quote(f.Comment) + "\n")
	if f.HasScreenshot {
		fmt.Fprintf(&b, "\n![screenshot](https://%s/_prevly/feedback/%s/screenshot.png)\n", baseDomain, f.ID)
	}
	if line := elementLine(f); line != "" {
		b.WriteString("\n**Element:** " + line + "\n")
	}
	b.WriteString("\n<details><summary>Environment</summary>\n\n" + environment(f) + "\n</details>\n")
	if len(f.Console) > 0 {
		fmt.Fprintf(&b, "\n<details><summary>Console (%s)</summary>\n\n```\n%s\n```\n</details>\n",
			consoleCount(f.Console), consoleBody(f.Console))
	}
	return b.String()
}

func elementLine(f *model.Feedback) string {
	var parts []string
	if f.Selector != "" {
		parts = append(parts, "`"+sanitize(f.Selector)+"`")
	}
	if f.Element != nil && f.Element.Text != "" {
		parts = append(parts, `"`+sanitize(f.Element.Text)+`"`)
	} else if f.Element != nil && f.Element.Tag != "" {
		parts = append(parts, "`<"+sanitize(f.Element.Tag)+">`")
	}
	if f.Click != nil {
		parts = append(parts, fmt.Sprintf("at (%d, %d)", f.Click.X, f.Click.Y))
	}
	return strings.Join(parts, " · ")
}

func environment(f *model.Feedback) string {
	parts := []string{"Reported by " + sanitize(f.Author)}
	if f.Viewport != nil {
		vp := fmt.Sprintf("viewport %d×%d", f.Viewport.W, f.Viewport.H)
		if f.Viewport.DPR > 0 {
			vp += " @" + strconv.FormatFloat(f.Viewport.DPR, 'g', -1, 64) + "x"
		}
		parts = append(parts, vp)
	}
	if f.CommitSHA != "" {
		parts = append(parts, "commit `"+shortSHA(f.CommitSHA)+"`")
	}
	if f.UserAgent != "" {
		parts = append(parts, sanitize(f.UserAgent))
	}
	return strings.Join(parts, " · ")
}

func consoleCount(entries []model.ConsoleEntry) string {
	var errs int
	for _, e := range entries {
		if e.Level == "error" {
			errs++
		}
	}
	if errs == len(entries) {
		return plural(errs, "error")
	}
	return plural(len(entries), "entry", "entries")
}

func consoleBody(entries []model.ConsoleEntry) string {
	lines := make([]string, 0, len(entries))
	for _, e := range entries {
		lines = append(lines, strings.TrimSpace(e.At+" "+e.Level+" "+fence(e.Message)))
	}
	return strings.Join(lines, "\n")
}

func plural(n int, forms ...string) string {
	word := forms[0]
	if n != 1 {
		if len(forms) > 1 {
			word = forms[1]
		} else {
			word += "s"
		}
	}
	return strconv.Itoa(n) + " " + word
}

func quote(s string) string {
	lines := strings.Split(sanitize(s), "\n")
	for i, l := range lines {
		lines[i] = "> " + l
	}
	return strings.Join(lines, "\n")
}

// sanitize neutralises HTML comment openers in reviewer-supplied text. A report
// whose body contains `<!-- prevly -->` would otherwise be mistaken for the
// sticky comment and overwritten by the next status update.
func sanitize(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "<!--", "&lt;!--")
	return strings.ReplaceAll(s, "-->", "--&gt;")
}

// fence keeps reviewer text from closing the console code block.
func fence(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")
	return strings.ReplaceAll(s, "```", "'''")
}

func shortSHA(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}
