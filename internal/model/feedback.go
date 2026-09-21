package model

import (
	"fmt"
	"time"
)

// Element is the DOM element a reviewer pointed at, described well enough that
// a reader never has to guess which node is meant.
type Element struct {
	Tag       string            `json:"tag,omitempty"`
	Text      string            `json:"text,omitempty"`
	XPath     string            `json:"xpath,omitempty"`
	Attrs     map[string]string `json:"attrs,omitempty"`
	Classes   []string          `json:"classes,omitempty"`
	Ancestors []string          `json:"ancestors,omitempty"`
	Heading   string            `json:"heading,omitempty"`
}

// Point is a viewport coordinate.
type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Rect is an element's bounding box in the viewport.
type Rect struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

// Viewport is the reviewer's viewport size and device pixel ratio.
type Viewport struct {
	W   int     `json:"w"`
	H   int     `json:"h"`
	DPR float64 `json:"dpr"`
}

// ConsoleEntry is one browser console line captured with a feedback report.
type ConsoleEntry struct {
	Level   string `json:"level"`
	Message string `json:"message"`
	At      string `json:"at"`
}

// Feedback is one reviewer annotation captured on a preview and mirrored as a
// PR comment. It is stored whole; the list endpoint returns a subset.
type Feedback struct {
	ID       string `json:"id"`
	Repo     string `json:"repo"`
	PRNumber int    `json:"pr"`
	AppName  string `json:"app"`

	Page     string    `json:"page"`
	Author   string    `json:"author"`
	Comment  string    `json:"comment"`
	Title    string    `json:"title,omitempty"`
	Selector string    `json:"selector,omitempty"`
	Element  *Element  `json:"element,omitempty"`
	Click    *Point    `json:"click,omitempty"`
	Rect     *Rect     `json:"rect,omitempty"`
	Viewport *Viewport `json:"viewport,omitempty"`

	CreatedAt time.Time `json:"created_at"`

	Host           string `json:"host"`
	InstallationID int64  `json:"installation_id"`
	CommitSHA      string `json:"commit_sha,omitempty"`
	Client         string `json:"client,omitempty"`

	Console       []ConsoleEntry `json:"console,omitempty"`
	HasScreenshot bool           `json:"screenshot"`

	CommentID    int64  `json:"comment_id"`
	CommentURL   string `json:"comment_url,omitempty"`
	PostAttempts int    `json:"post_attempts,omitempty"`
}

// Key returns the store key of the feedback record.
func (f *Feedback) Key() string {
	return FeedbackKey(f.Repo, f.PRNumber, f.AppName, f.ID)
}

// FeedbackKey builds a feedback store key from its components. The id suffix is
// time-ordered, so records of one preview iterate oldest first.
func FeedbackKey(repo string, pr int, app, id string) string {
	return fmt.Sprintf("%s#%d#%s#%s", repo, pr, app, id)
}

// FeedbackPreviewPrefix is the key prefix covering every feedback record of one
// preview.
func FeedbackPreviewPrefix(repo string, pr int, app string) string {
	return fmt.Sprintf("%s#%d#%s#", repo, pr, app)
}
