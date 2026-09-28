package feedback

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/RedBoardDev/prevly/internal/model"
)

const zeroWidthSpace = "​"

var (
	mentionRe  = regexp.MustCompile(`@(\w)`)
	issueRefRe = regexp.MustCompile(`#(\d)`)
	ghRefRe    = regexp.MustCompile(`GH-(\d)`)
	imageRe    = regexp.MustCompile(`!\[`)
)

// inert neutralises every GitHub-active construct reviewer-supplied text
// could carry: a site's feedback endpoint is reached by anyone who can reach
// the host application, never gated by an activation link the way a preview
// is, so nothing here can be trusted to stay inert markdown on its own.
func inert(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = mentionRe.ReplaceAllString(s, "@"+zeroWidthSpace+"$1")
	s = issueRefRe.ReplaceAllString(s, "#"+zeroWidthSpace+"$1")
	s = ghRefRe.ReplaceAllString(s, "GH-"+zeroWidthSpace+"$1")
	s = imageRe.ReplaceAllString(s, "!"+zeroWidthSpace+"[")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}

func siteIssueMarker(id string) string { return "<!-- prevly-site-report:" + id + " -->" }

// RenderSiteIssue renders the GitHub issue title and body for one site
// report. Every reviewer-supplied string, table keys included, passes through
// inert() before it reaches the markdown.
func RenderSiteIssue(f *model.Feedback, site, baseDomain string) (title, body string) {
	var b strings.Builder
	b.WriteString(siteIssueMarker(f.ID) + "\n")
	glyph, kind := siteTypeHeading(f.Type)
	fmt.Fprintf(&b, "### %s %s · %s · `%s`\n\n", glyph, kind, inert(f.Author), inert(site))
	b.WriteString(siteQuote(f.Comment) + "\n")

	if f.HasScreenshot {
		fmt.Fprintf(&b, "\n<details><summary>Screenshot</summary>\n\n![screenshot](https://%s/_prevly/feedback/%s/screenshot.png)\n\n</details>\n",
			baseDomain, f.ID)
	}

	fmt.Fprintf(&b, "\n<details><summary>Where exactly</summary>\n\n%s\n</details>\n", siteLocationTable(f, site))

	if len(f.Console) > 0 {
		fmt.Fprintf(&b, "\n<details><summary>Console (%s)</summary>\n\n```\n%s\n```\n\n</details>\n",
			consoleCount(f.Console), siteConsoleBody(f.Console))
	}

	if len(f.Network) > 0 {
		fmt.Fprintf(&b, "\n<details><summary>Network (%s)</summary>\n\n```\n%s\n```\n\n</details>\n",
			plural(len(f.Network), "failed request"), siteNetworkBody(f.Network))
	}

	return issueTitle(f.Comment), b.String()
}

func siteTypeHeading(kind string) (string, string) {
	switch kind {
	case "design":
		return "🎨", "Design"
	case "question":
		return "❓", "Question"
	case "bug", "":
		return "🐞", "Bug"
	default:
		return "🏷️", inert(humanizeTypeID(kind))
	}
}

func siteCode(s string) string {
	s = inert(s)
	s = strings.ReplaceAll(s, "`", "'")
	s = strings.ReplaceAll(s, "|", "\\|")
	return "`" + s + "`"
}

func siteQuote(s string) string {
	lines := strings.Split(inert(s), "\n")
	for i, l := range lines {
		lines[i] = "> " + l
	}
	return strings.Join(lines, "\n")
}

func siteLocationTable(f *model.Feedback, site string) string {
	rows := [][2]string{
		{"Page", siteCode(f.Page)},
		{"Site", siteCode(site)},
	}
	if f.Title != "" {
		rows = append(rows, [2]string{"Page title", inert(f.Title)})
	}
	for _, key := range sortedKeys(f.Context) {
		rows = append(rows, [2]string{inert(key), siteCode(f.Context[key])})
	}
	if f.Element != nil && f.Element.Heading != "" {
		rows = append(rows, [2]string{"Section", inert(f.Element.Heading)})
	}
	if f.Selector != "" {
		rows = append(rows, [2]string{"CSS selector", siteCode(f.Selector)})
	}
	if f.Element != nil {
		rows = append(rows, siteElementRows(f.Element)...)
	}
	if f.Click != nil {
		rows = append(rows, [2]string{"Clicked at", fmt.Sprintf("x %d, y %d in the viewport", f.Click.X, f.Click.Y)})
	}
	if f.Rect != nil {
		rows = append(rows, [2]string{"Bounding box", fmt.Sprintf("%d×%d at x %d, y %d", f.Rect.W, f.Rect.H, f.Rect.X, f.Rect.Y)})
	}
	if f.Viewport != nil {
		vp := fmt.Sprintf("%d×%d", f.Viewport.W, f.Viewport.H)
		if f.Viewport.DPR > 0 {
			vp += " @" + strconv.FormatFloat(f.Viewport.DPR, 'g', -1, 64) + "x"
		}
		rows = append(rows, [2]string{"Viewport", vp})
	}
	if f.Client != "" {
		rows = append(rows, [2]string{"Browser", inert(f.Client)})
	}
	rows = append(rows, [2]string{"Reported", f.CreatedAt.UTC().Format("2006-01-02 15:04 UTC")})

	var b strings.Builder
	b.WriteString("| | |\n|---|---|\n")
	for _, r := range rows {
		fmt.Fprintf(&b, "| %s | %s |\n", r[0], r[1])
	}
	return b.String()
}

func siteElementRows(e *model.Element) [][2]string {
	var rows [][2]string
	if e.Tag != "" {
		rows = append(rows, [2]string{"Element", siteCode("<" + e.Tag + ">")})
	}
	if e.Text != "" {
		rows = append(rows, [2]string{"Element text", `"` + inert(e.Text) + `"`})
	}
	if len(e.Attrs) > 0 {
		names := make([]string, 0, len(e.Attrs))
		for name := range e.Attrs {
			names = append(names, name)
		}
		sort.Strings(names)
		parts := make([]string, 0, len(names))
		for _, name := range names {
			parts = append(parts, siteCode(name+`="`+e.Attrs[name]+`"`))
		}
		rows = append(rows, [2]string{"Attributes", strings.Join(parts, " ")})
	}
	if len(e.Classes) > 0 {
		rows = append(rows, [2]string{"Classes", siteCode("." + strings.Join(e.Classes, "."))})
	}
	if len(e.Ancestors) > 0 {
		rows = append(rows, [2]string{"Ancestors", siteCode(strings.Join(e.Ancestors, " > "))})
	}
	if e.XPath != "" {
		rows = append(rows, [2]string{"XPath", siteCode(e.XPath)})
	}
	return rows
}

func siteConsoleBody(entries []model.ConsoleEntry) string {
	lines := make([]string, 0, len(entries))
	for _, e := range entries {
		lines = append(lines, strings.TrimSpace(e.At+" "+e.Level+" "+fence(inert(e.Message))))
	}
	return strings.Join(lines, "\n")
}

func siteNetworkBody(entries []model.NetworkEntry) string {
	lines := make([]string, 0, len(entries))
	for _, e := range entries {
		status := strconv.Itoa(e.Status)
		if e.Status == 0 {
			status = "no response"
		}
		line := strings.TrimSpace(e.Method + " " + inert(e.Path) + " " + status)
		if e.RequestID != "" {
			line += " x-request-id=" + inert(e.RequestID)
		}
		if e.At != "" {
			line = e.At + " " + line
		}
		lines = append(lines, fence(line))
	}
	return strings.Join(lines, "\n")
}

func issueTitle(comment string) string {
	first := comment
	if i := strings.IndexByte(first, '\n'); i >= 0 {
		first = first[:i]
	}
	first = inert(strings.TrimSpace(first))
	return truncateRunes(first, 80)
}

func truncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	r := []rune(s)
	return string(r[:max])
}
