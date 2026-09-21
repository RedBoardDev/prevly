package feedback

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/RedBoardDev/prevly/internal/model"
)

// Part and field limits of POST /_prevly/api/feedback.
const (
	maxMetaBytes       = 64 << 10
	maxScreenshotBytes = 3 << 20
	maxRequestBytes    = maxScreenshotBytes + 2*maxMetaBytes

	maxAuthor    = 80
	maxComment   = 4000
	maxPage      = 2048
	maxTitle     = 200
	maxSelector  = 500
	maxElemTag   = 40
	maxElemText  = 120
	maxUserAgent = 400

	maxConsole        = 20
	maxConsoleMessage = 500
	maxConsoleLevel   = 20
	maxConsoleAt      = 40
)

// postTimeout bounds the synchronous PR comment; a slower GitHub leaves the
// report stored and unposted for the reconcile loop.
const postTimeout = 10 * time.Second

// pngMagic is the PNG file signature.
var pngMagic = []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}

// PreviewHandler answers /_prevly/ requests addressed to a preview host. It is
// registered on the proxy and never reaches (or wakes) the container.
func (s *Service) PreviewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /_prevly/feedback.js", s.serveScript)
	mux.HandleFunc("GET /_prevly/activate", s.activate)
	mux.HandleFunc("GET /_prevly/api/feedback", s.listReports)
	mux.HandleFunc("POST /_prevly/api/feedback", s.createReport)
	mux.HandleFunc("GET /_prevly/feedback/{id}/screenshot.png", s.serveScreenshot)
	mux.HandleFunc("/_prevly/", notFound)
	return mux
}

// ControlHandler serves the host-wide assets on the base domain: the widget
// bundle and the screenshots the PR comments point at.
func (s *Service) ControlHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /_prevly/feedback.js", s.serveScript)
	mux.HandleFunc("GET /_prevly/feedback/{id}/screenshot.png", s.serveScreenshot)
	mux.HandleFunc("/_prevly/", notFound)
	return mux
}

// activate turns the widget on for this browser and sends it back to the app.
// The flag cannot ride on a query parameter: every app in front of a login
// redirects the entry URL and drops the query before any script runs, so the
// daemon has to hand the browser something that survives a redirect.
func (s *Service) activate(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.previewFor(r); !ok {
		notFound(w, r)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     activationCookie,
		Value:    "1",
		Path:     "/",
		MaxAge:   int(activationTTL.Seconds()),
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, redirectTarget(r.URL.Query().Get("to")), http.StatusFound)
}

// redirectTarget keeps the browser on the preview: only a same-origin absolute
// path is honoured, anything else falls back to the app root.
func redirectTarget(to string) string {
	if strings.HasPrefix(to, "/") && !strings.HasPrefix(to, "//") && !strings.HasPrefix(to, "/_prevly/") {
		return to
	}
	return "/"
}

func notFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotFound, "not found")
}

func (s *Service) serveScript(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(scriptJS)
}

func (s *Service) serveScreenshot(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validID(id) {
		notFound(w, r)
		return
	}
	f, err := os.Open(s.screenshotPath(id))
	if err != nil {
		notFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		notFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, id+".png", info.ModTime(), f)
}

func (s *Service) listReports(w http.ResponseWriter, r *http.Request) {
	p, ok := s.previewFor(r)
	if !ok {
		notFound(w, r)
		return
	}
	records, err := s.store.ListFeedbackByHost(p.Host)
	if err != nil {
		s.logger.Error("list feedback", "host", p.Host, "err", err)
		writeError(w, http.StatusInternalServerError, "store error")
		return
	}
	items := make([]reportJSON, 0, len(records))
	for _, f := range records {
		items = append(items, s.toJSON(f))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Service) createReport(w http.ResponseWriter, r *http.Request) {
	p, ok := s.previewFor(r)
	if !ok {
		notFound(w, r)
		return
	}
	if allowed, retry := s.limiter.allow(p.Host); !allowed {
		w.Header().Set("Retry-After", strconv.Itoa(int(retry.Round(time.Second)/time.Second)))
		writeError(w, http.StatusTooManyRequests, "too many reports for this preview")
		return
	}
	if !isMultipart(r) {
		writeError(w, http.StatusUnsupportedMediaType, "expected multipart/form-data")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	m, shot, err := readParts(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := m.validate(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	id, err := NewID(s.now())
	if err != nil {
		s.logger.Error("feedback id", "err", err)
		writeError(w, http.StatusInternalServerError, "id error")
		return
	}
	if len(shot) > 0 {
		if err := s.saveScreenshot(id, shot); err != nil {
			s.logger.Error("save screenshot", "id", id, "err", err)
			writeError(w, http.StatusInternalServerError, "screenshot error")
			return
		}
	}

	f := m.record(id, p, s.now().UTC(), len(shot) > 0)
	// Store before posting: a failed or slow GitHub must leave a record behind,
	// or the report is lost with no way for the loop to retry it.
	if err := s.store.PutFeedback(f); err != nil {
		s.logger.Error("store feedback", "id", id, "err", err)
		writeError(w, http.StatusInternalServerError, "store error")
		return
	}

	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), postTimeout)
	defer cancel()
	s.postComment(ctx, f, p.URL)

	writeJSON(w, http.StatusCreated, map[string]any{"item": s.toJSON(f)})
}

func (s *Service) previewFor(r *http.Request) (*model.Preview, bool) {
	p, err := s.store.ListByHost(hostOnly(r.Host))
	if err != nil || p == nil {
		return nil, false
	}
	if !p.FeedbackOn() {
		return nil, false
	}
	return p, true
}

func (s *Service) saveScreenshot(id string, data []byte) error {
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}
	return os.WriteFile(s.screenshotPath(id), data, 0o600)
}

func isMultipart(r *http.Request) bool {
	ct, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	return err == nil && ct == "multipart/form-data"
}

func readParts(r *http.Request) (*meta, []byte, error) {
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, nil, errors.New("invalid multipart body")
	}
	var (
		m    *meta
		shot []byte
	)
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, nil, errors.New("invalid multipart body")
		}
		switch part.FormName() {
		case "meta":
			raw, err := readPart(part, maxMetaBytes)
			if err != nil {
				return nil, nil, fmt.Errorf("meta part: %w", err)
			}
			m = &meta{}
			if err := json.Unmarshal(raw, m); err != nil {
				return nil, nil, errors.New("meta part: invalid json")
			}
		case "screenshot":
			shot, err = readPart(part, maxScreenshotBytes)
			if err != nil {
				return nil, nil, fmt.Errorf("screenshot part: %w", err)
			}
			if len(shot) > 0 && !bytes.HasPrefix(shot, pngMagic) {
				return nil, nil, errors.New("screenshot part: not a png")
			}
		default:
			_, _ = io.Copy(io.Discard, io.LimitReader(part, maxMetaBytes))
		}
		_ = part.Close()
	}
	if m == nil {
		return nil, nil, errors.New("meta part: missing")
	}
	return m, shot, nil
}

func readPart(part *multipart.Part, limit int) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(part, int64(limit)+1))
	if err != nil {
		return nil, errors.New("unreadable")
	}
	if len(data) > limit {
		return nil, fmt.Errorf("larger than %d bytes", limit)
	}
	return data, nil
}

// meta is the JSON part of a report, as posted by the widget.
type meta struct {
	Author    string               `json:"author"`
	Comment   string               `json:"comment"`
	Page      string               `json:"page"`
	Title     string               `json:"title"`
	Selector  string               `json:"selector"`
	Element   *model.Element       `json:"element"`
	Click     *model.Point         `json:"click"`
	Rect      *model.Rect          `json:"rect"`
	Viewport  *model.Viewport      `json:"viewport"`
	UserAgent string               `json:"userAgent"`
	Console   []model.ConsoleEntry `json:"console"`
}

func (m *meta) validate() error {
	m.Author = strings.TrimSpace(m.Author)
	m.Comment = strings.TrimSpace(m.Comment)
	m.Page = strings.TrimSpace(m.Page)
	if err := between("author", m.Author, 1, maxAuthor); err != nil {
		return err
	}
	if err := between("comment", m.Comment, 1, maxComment); err != nil {
		return err
	}
	if err := between("page", m.Page, 1, maxPage); err != nil {
		return err
	}
	if !strings.HasPrefix(m.Page, "/") {
		return errors.New("page must start with /")
	}
	if err := atMost("title", m.Title, maxTitle); err != nil {
		return err
	}
	if err := atMost("selector", m.Selector, maxSelector); err != nil {
		return err
	}
	if err := atMost("userAgent", m.UserAgent, maxUserAgent); err != nil {
		return err
	}
	if m.Element != nil {
		if err := atMost("element.tag", m.Element.Tag, maxElemTag); err != nil {
			return err
		}
		if err := atMost("element.text", m.Element.Text, maxElemText); err != nil {
			return err
		}
	}
	if len(m.Console) > maxConsole {
		return fmt.Errorf("console: at most %d entries", maxConsole)
	}
	for i := range m.Console {
		if err := atMost("console.message", m.Console[i].Message, maxConsoleMessage); err != nil {
			return err
		}
		if err := atMost("console.level", m.Console[i].Level, maxConsoleLevel); err != nil {
			return err
		}
		if err := atMost("console.at", m.Console[i].At, maxConsoleAt); err != nil {
			return err
		}
	}
	return nil
}

func (m *meta) record(id string, p *model.Preview, now time.Time, hasScreenshot bool) *model.Feedback {
	return &model.Feedback{
		ID:             id,
		Repo:           p.Repo,
		PRNumber:       p.PRNumber,
		AppName:        p.AppName,
		Page:           m.Page,
		Author:         m.Author,
		Comment:        m.Comment,
		Title:          m.Title,
		Selector:       m.Selector,
		Element:        m.Element,
		Click:          m.Click,
		Rect:           m.Rect,
		Viewport:       m.Viewport,
		CreatedAt:      now,
		Host:           p.Host,
		InstallationID: p.InstallationID,
		CommitSHA:      p.CommitSHA,
		UserAgent:      m.UserAgent,
		Console:        m.Console,
		HasScreenshot:  hasScreenshot,
	}
}

func between(field, value string, minLen, maxLen int) error {
	n := utf8.RuneCountInString(value)
	if n < minLen || n > maxLen {
		return fmt.Errorf("%s: must be %d-%d characters", field, minLen, maxLen)
	}
	return nil
}

func atMost(field, value string, maxLen int) error {
	if utf8.RuneCountInString(value) > maxLen {
		return fmt.Errorf("%s: at most %d characters", field, maxLen)
	}
	return nil
}

// reportJSON is the API shape of a report: userAgent and console are stored and
// rendered in the PR comment but never returned.
type reportJSON struct {
	ID            string          `json:"id"`
	Repo          string          `json:"repo"`
	PR            int             `json:"pr"`
	App           string          `json:"app"`
	Page          string          `json:"page"`
	Author        string          `json:"author"`
	Comment       string          `json:"comment"`
	Title         string          `json:"title,omitempty"`
	Selector      string          `json:"selector,omitempty"`
	Element       *model.Element  `json:"element,omitempty"`
	Click         *model.Point    `json:"click,omitempty"`
	Rect          *model.Rect     `json:"rect,omitempty"`
	Viewport      *model.Viewport `json:"viewport,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	CommentURL    *string         `json:"comment_url"`
	ScreenshotURL *string         `json:"screenshot_url"`
}

func (s *Service) toJSON(f *model.Feedback) reportJSON {
	out := reportJSON{
		ID:        f.ID,
		Repo:      f.Repo,
		PR:        f.PRNumber,
		App:       f.AppName,
		Page:      f.Page,
		Author:    f.Author,
		Comment:   f.Comment,
		Title:     f.Title,
		Selector:  f.Selector,
		Element:   f.Element,
		Click:     f.Click,
		Rect:      f.Rect,
		Viewport:  f.Viewport,
		CreatedAt: f.CreatedAt,
	}
	if f.CommentURL != "" {
		url := f.CommentURL
		out.CommentURL = &url
	}
	if f.HasScreenshot {
		url := s.screenshotURL(f.ID)
		out.ScreenshotURL = &url
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
