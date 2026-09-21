package feedback

import (
	"strings"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
)

func sampleRecord() *model.Feedback {
	return &model.Feedback{
		ID:       "01J8ABCDEFGHJKMNPQRSTVWXYZ",
		Repo:     "akord-securite/KARE",
		PRNumber: 1268,
		AppName:  "kare",
		Page:     "/reports/123?tab=costs",
		Author:   "Thomas",
		Comment:  "The total is wrong",
		Selector: "main > table tr:nth-child(3) td.total",
		Element: &model.Element{
			Tag: "td", Text: "1 234,00 €",
			XPath:     "/html/body/main/table/tbody/tr[3]/td[4]",
			Attrs:     map[string]string{"id": "grand-total", "data-testid": "total"},
			Classes:   []string{"total", "num"},
			Ancestors: []string{"main#report", "table.prestations", "tbody", "tr"},
			Heading:   "Détail des prestations",
		},
		Click:     &model.Point{X: 812, Y: 403},
		Viewport:  &model.Viewport{W: 1440, H: 900, DPR: 2},
		CreatedAt: time.Date(2026, 9, 21, 10, 12, 40, 0, time.UTC),
		CommitSHA: "abc1234def5678",
		Client:    "Chrome 130 on macOS",
		Console: []model.ConsoleEntry{
			{Level: "error", Message: "TypeError: boom", At: "2026-09-21T10:12:33Z"},
			{Level: "error", Message: "TypeError: bam", At: "2026-09-21T10:12:34Z"},
		},
		HasScreenshot: true,
	}
}

func TestRenderComment(t *testing.T) {
	t.Parallel()
	body := RenderComment(sampleRecord(), "preview.example.com", "https://pr-1268-kare.preview.example.com")

	want := []string{
		"<!-- prevly-feedback:01J8ABCDEFGHJKMNPQRSTVWXYZ -->",
		"### 💬 Thomas · `kare` · [/reports/123?tab=costs](<https://pr-1268-kare.preview.example.com/reports/123?tab=costs>)",
		"> The total is wrong",
		"<details><summary>Screenshot</summary>",
		"![screenshot](https://preview.example.com/_prevly/feedback/01J8ABCDEFGHJKMNPQRSTVWXYZ/screenshot.png)",
		"<details><summary>Where exactly</summary>",
		"| URL | <https://pr-1268-kare.preview.example.com/reports/123?tab=costs> |",
		"| Section | Détail des prestations |",
		"| CSS selector | `main > table tr:nth-child(3) td.total` |",
		"| Element | `<td>` |",
		`| Element text | "1 234,00 €" |`,
		"| Attributes | `data-testid=\"total\"` `id=\"grand-total\"` |",
		"| Classes | `.total.num` |",
		"| Ancestors | `main#report > table.prestations > tbody > tr` |",
		"| XPath | `/html/body/main/table/tbody/tr[3]/td[4]` |",
		"| Clicked at | x 812, y 403 in the viewport |",
		"| Viewport | 1440×900 @2x |",
		"| Commit | `abc1234` |",
		"| Browser | Chrome 130 on macOS |",
		"| Reported | 2026-09-21 10:12 UTC |",
		"<details><summary>Console (2 errors)</summary>",
		"2026-09-21T10:12:33Z error TypeError: boom",
	}
	for _, w := range want {
		if !strings.Contains(body, w) {
			t.Fatalf("comment missing %q:\n%s", w, body)
		}
	}
	if strings.Contains(body, "<!-- prevly -->") {
		t.Fatal("a feedback comment must never carry the sticky marker")
	}
}

// Everything but the reviewer's own words is folded, so a PR with many reports
// stays readable.
func TestRenderCommentFoldsEverythingButTheWords(t *testing.T) {
	t.Parallel()
	body := RenderComment(sampleRecord(), "preview.example.com", "https://pr-1268-kare.preview.example.com")

	visible, _, found := strings.Cut(body, "<details>")
	if !found {
		t.Fatal("nothing is folded")
	}
	if strings.Contains(visible, "screenshot") || strings.Contains(visible, "XPath") ||
		strings.Contains(visible, "Viewport") || strings.Contains(visible, "TypeError") {
		t.Fatalf("context leaked above the fold:\n%s", visible)
	}
	if !strings.Contains(visible, "> The total is wrong") {
		t.Fatalf("the reviewer's words must stay visible:\n%s", visible)
	}
	if strings.Count(body, "<details>") != strings.Count(body, "</details>") {
		t.Fatal("unbalanced details blocks")
	}
}

func TestRenderCommentMinimal(t *testing.T) {
	t.Parallel()
	f := &model.Feedback{
		ID: "01J8ABCDEFGHJKMNPQRSTVWXYZ", AppName: "web", Page: "/",
		Author: "T", Comment: "nope",
	}
	body := RenderComment(f, "base.example.com", "https://pr-1.base.example.com")
	if strings.Contains(body, "![screenshot]") {
		t.Fatal("no screenshot line without an image")
	}
	if strings.Contains(body, "<details><summary>Screenshot") {
		t.Fatal("no screenshot block without an image")
	}
	if strings.Contains(body, "XPath") || strings.Contains(body, "Element text") {
		t.Fatal("no element rows without an element")
	}
	if strings.Contains(body, "Console (") {
		t.Fatal("no console block without entries")
	}
	if !strings.Contains(body, "### 💬 T · `web`") {
		t.Fatalf("heading missing:\n%s", body)
	}
}

func TestRenderCommentEscapesMarkers(t *testing.T) {
	t.Parallel()
	f := sampleRecord()
	f.Comment = "look: <!-- prevly --> and closing -->"
	f.Author = "<!-- prevly -->"
	f.Console = []model.ConsoleEntry{{Level: "log", Message: "```\nfence"}}

	body := RenderComment(f, "base.example.com", "https://pr-1.base.example.com")
	if strings.Contains(body, "<!-- prevly -->") {
		t.Fatalf("sticky marker leaked through user text:\n%s", body)
	}
	if strings.Count(body, "```") != 2 {
		t.Fatalf("console fence was not neutralised:\n%s", body)
	}
	if !strings.Contains(body, "Console (1 entry)") {
		t.Fatalf("non-error console entries must not be counted as errors:\n%s", body)
	}
}

func TestRenderCommentQuotesEveryLine(t *testing.T) {
	t.Parallel()
	f := sampleRecord()
	f.Comment = "line one\nline two"
	body := RenderComment(f, "base.example.com", "https://pr-1.base.example.com")
	if !strings.Contains(body, "> line one\n> line two") {
		t.Fatalf("multi-line comment not fully quoted:\n%s", body)
	}
}
