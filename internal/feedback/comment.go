package feedback

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/RedBoardDev/prevly/internal/model"
)

// commentMarker prefixes the PR comment of a report so it is identifiable
// without being prevly's sticky marker.
func commentMarker(id string) string { return "<!-- prevly-feedback:" + id + " -->" }

// RenderComment renders the pull request comment body for one report. Only the
// heading and the reviewer's words are visible; the screenshot, the location
// table and the console are folded, so a thread of reports stays readable.
// Pure, so the exact markdown is unit-tested.
func RenderComment(f *model.Feedback, baseDomain, previewURL string) string {
	var b strings.Builder
	b.WriteString(commentMarker(f.ID) + "\n")
	glyph, kind := typeHeading(f.Type)
	fmt.Fprintf(&b, "### %s %s · %s · `%s` · [%s](<%s>)\n\n",
		glyph, kind, sanitize(f.Author), sanitize(f.AppName), sanitize(f.Page), previewURL+f.Page)
	b.WriteString(quote(f.Comment) + "\n")

	if f.HasScreenshot {
		fmt.Fprintf(&b, "\n<details><summary>Screenshot</summary>\n\n![screenshot](https://%s/_prevly/feedback/%s/screenshot.png)\n\n</details>\n",
			baseDomain, f.ID)
	}

	fmt.Fprintf(&b, "\n<details><summary>Where exactly</summary>\n\n%s\n</details>\n", locationTable(f, previewURL))

	if len(f.Console) > 0 {
		fmt.Fprintf(&b, "\n<details><summary>Console (%s)</summary>\n\n```\n%s\n```\n\n</details>\n",
			consoleCount(f.Console), consoleBody(f.Console))
	}

	if len(f.Network) > 0 {
		fmt.Fprintf(&b, "\n<details><summary>Network (%s)</summary>\n\n```\n%s\n```\n\n</details>\n",
			plural(len(f.Network), "failed request"), networkBody(f.Network))
	}
	return b.String()
}

// typeHeading turns a report type into the glyph and word that open the
// comment. The three built-ins keep their own glyph and name; a missing type
// reads as a bug, like the widget default. Any other id (a host's own
// configured type) gets one neutral glyph and its id, capitalized — sanitized
// like any other reviewer-supplied text, since the id travels from the client.
func typeHeading(kind string) (string, string) {
	switch kind {
	case "design":
		return "🎨", "Design"
	case "question":
		return "❓", "Question"
	case "bug", "":
		return "🐞", "Bug"
	default:
		return "🏷️", sanitize(humanizeTypeID(kind))
	}
}

// humanizeTypeID turns a report type id ("feature-request") into a heading
// ("Feature Request"): hyphens become spaces, each word capitalized.
func humanizeTypeID(id string) string {
	words := strings.Split(id, "-")
	for i, w := range words {
		if w == "" {
			continue
		}
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}

func networkBody(entries []model.NetworkEntry) string {
	lines := make([]string, 0, len(entries))
	for _, e := range entries {
		status := strconv.Itoa(e.Status)
		if e.Status == 0 {
			status = "no response"
		}
		line := strings.TrimSpace(e.Method + " " + e.Path + " " + status)
		if e.RequestID != "" {
			line += " x-request-id=" + e.RequestID
		}
		if e.At != "" {
			line = e.At + " " + line
		}
		lines = append(lines, fence(line))
	}
	return strings.Join(lines, "\n")
}

// locationTable is written for whoever has to find the element again, a person
// or an agent: every row is something to search for, never prose.
func locationTable(f *model.Feedback, previewURL string) string {
	rows := [][2]string{
		{"URL", "<" + previewURL + f.Page + ">"},
		{"App", code(f.AppName)},
	}
	if f.Title != "" {
		rows = append(rows, [2]string{"Page title", sanitize(f.Title)})
	}
	for _, key := range sortedKeys(f.Context) {
		rows = append(rows, [2]string{sanitize(key), code(f.Context[key])})
	}
	if f.Element != nil && f.Element.Heading != "" {
		rows = append(rows, [2]string{"Section", sanitize(f.Element.Heading)})
	}
	if f.Selector != "" {
		rows = append(rows, [2]string{"CSS selector", code(f.Selector)})
	}
	if f.Element != nil {
		rows = append(rows, elementRows(f.Element)...)
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
	if f.CommitSHA != "" {
		rows = append(rows, [2]string{"Commit", code(shortSHA(f.CommitSHA))})
	}
	if f.Client != "" {
		rows = append(rows, [2]string{"Browser", sanitize(f.Client)})
	}
	rows = append(rows, [2]string{"Reported", f.CreatedAt.UTC().Format("2006-01-02 15:04 UTC")})

	var b strings.Builder
	b.WriteString("| | |\n|---|---|\n")
	for _, r := range rows {
		fmt.Fprintf(&b, "| %s | %s |\n", r[0], r[1])
	}
	return b.String()
}

func sortedKeys(m map[string]string) []string {
	if len(m) == 0 {
		return nil
	}
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func elementRows(e *model.Element) [][2]string {
	var rows [][2]string
	if e.Tag != "" {
		rows = append(rows, [2]string{"Element", code("<" + e.Tag + ">")})
	}
	if e.Text != "" {
		rows = append(rows, [2]string{"Element text", `"` + sanitize(e.Text) + `"`})
	}
	if len(e.Attrs) > 0 {
		names := make([]string, 0, len(e.Attrs))
		for name := range e.Attrs {
			names = append(names, name)
		}
		sort.Strings(names)
		parts := make([]string, 0, len(names))
		for _, name := range names {
			parts = append(parts, code(name+`="`+e.Attrs[name]+`"`))
		}
		rows = append(rows, [2]string{"Attributes", strings.Join(parts, " ")})
	}
	if len(e.Classes) > 0 {
		rows = append(rows, [2]string{"Classes", code("." + strings.Join(e.Classes, "."))})
	}
	if len(e.Ancestors) > 0 {
		rows = append(rows, [2]string{"Ancestors", code(strings.Join(e.Ancestors, " > "))})
	}
	if e.XPath != "" {
		rows = append(rows, [2]string{"XPath", code(e.XPath)})
	}
	return rows
}

// code renders a value inside a code span. A pipe would split the table cell
// and a backtick would close the span, so both are neutralised.
func code(s string) string {
	s = sanitize(s)
	s = strings.ReplaceAll(s, "`", "'")
	s = strings.ReplaceAll(s, "|", "\\|")
	return "`" + s + "`"
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
