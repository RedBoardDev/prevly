package feedback

import (
	"strings"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/model"
)

func sampleRecord() *model.Feedback {
	return &model.Feedback{
		ID:        "01J8ABCDEFGHJKMNPQRSTVWXYZ",
		Repo:      "akord-securite/KARE",
		PRNumber:  1268,
		AppName:   "kare",
		Page:      "/reports/123?tab=costs",
		Author:    "Thomas",
		Comment:   "The total is wrong",
		Selector:  "main > table tr:nth-child(3) td.total",
		Element:   &model.Element{Tag: "td", Text: "1 234,00 €"},
		Click:     &model.Point{X: 812, Y: 403},
		Viewport:  &model.Viewport{W: 1440, H: 900, DPR: 2},
		CreatedAt: time.Date(2026, 9, 21, 10, 12, 40, 0, time.UTC),
		CommitSHA: "abc1234def5678",
		UserAgent: "Mozilla/5.0 Chrome/130",
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
		"### 💬 Feedback on `kare` · [/reports/123?tab=costs](<https://pr-1268-kare.preview.example.com/reports/123?tab=costs>)",
		"> The total is wrong",
		"![screenshot](https://preview.example.com/_prevly/feedback/01J8ABCDEFGHJKMNPQRSTVWXYZ/screenshot.png)",
		"**Element:** `main > table tr:nth-child(3) td.total` · \"1 234,00 €\" · at (812, 403)",
		"<details><summary>Environment</summary>",
		"Reported by Thomas · viewport 1440×900 @2x · commit `abc1234` · Mozilla/5.0 Chrome/130",
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
	if strings.Contains(body, "**Element:**") {
		t.Fatal("no element line without a selector, element or click")
	}
	if strings.Contains(body, "Console (") {
		t.Fatal("no console block without entries")
	}
	if !strings.Contains(body, "Reported by T") {
		t.Fatalf("environment block missing:\n%s", body)
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
