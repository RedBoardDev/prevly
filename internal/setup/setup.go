// Package setup implements prevly's one-time, in-daemon GitHub App creation
// flow. When the daemon starts without App credentials it serves a setup page
// on the base domain: the operator picks a name (and optional org), GitHub's
// manifest flow creates the App, and the callback returns to the daemon itself
// — no localhost dance, no copying secrets around. The resulting credentials are
// persisted under the data directory and the daemon switches to normal mode.
package setup

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	gh "github.com/google/go-github/v66/github"

	applog "github.com/RedBoardDev/prevly/internal/log"
)

const (
	credsFile = "app.json"
	keyFile   = "github-app.pem"
)

// Credentials is the GitHub App identity prevly persists after setup. The
// private key is stored next to it as a PEM file, never inlined in this JSON.
type Credentials struct {
	AppID         int64  `json:"app_id"`
	WebhookSecret string `json:"webhook_secret"`
	Slug          string `json:"slug"`
}

// NewToken returns a random hex token used to gate the setup page and to guard
// the manifest callback against CSRF.
func NewToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// Save persists the App credentials and private key under dataDir (mode 600).
func Save(dataDir string, c Credentials, privateKeyPEM []byte) error {
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("encode credentials: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, keyFile), privateKeyPEM, 0o600); err != nil {
		return fmt.Errorf("write app key: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, credsFile), data, 0o600); err != nil {
		return fmt.Errorf("write credentials: %w", err)
	}
	return nil
}

// Load returns the persisted credentials and private key. ok is false when no
// setup has completed yet (the credentials file is absent).
func Load(dataDir string) (creds Credentials, privateKeyPEM []byte, ok bool, err error) {
	data, err := os.ReadFile(filepath.Join(dataDir, credsFile))
	if os.IsNotExist(err) {
		return Credentials{}, nil, false, nil
	}
	if err != nil {
		return Credentials{}, nil, false, fmt.Errorf("read credentials: %w", err)
	}
	var c Credentials
	if err := json.Unmarshal(data, &c); err != nil {
		return Credentials{}, nil, false, fmt.Errorf("parse credentials: %w", err)
	}
	pem, err := os.ReadFile(filepath.Join(dataDir, keyFile))
	if err != nil {
		return Credentials{}, nil, false, fmt.Errorf("read app key: %w", err)
	}
	return c, pem, true, nil
}

// manifest is the GitHub App manifest prevly submits. Permissions and events
// match what the daemon relies on; keep in sync with
// packaging/github-app-manifest.json.
type manifest struct {
	Name               string            `json:"name"`
	URL                string            `json:"url"`
	HookAttributes     map[string]any    `json:"hook_attributes"`
	RedirectURL        string            `json:"redirect_url"`
	Public             bool              `json:"public"`
	DefaultPermissions map[string]string `json:"default_permissions"`
	DefaultEvents      []string          `json:"default_events"`
}

func appManifest(name, baseDomain, redirectURL string) manifest {
	return manifest{
		Name:           name,
		URL:            "https://github.com/RedBoardDev/prevly",
		HookAttributes: map[string]any{"url": "https://" + baseDomain + "/webhook", "active": true},
		RedirectURL:    redirectURL,
		Public:         false,
		DefaultPermissions: map[string]string{
			"contents":      "read",
			"pull_requests": "read",
			"deployments":   "write",
			"issues":        "write",
			"checks":        "write",
			"metadata":      "read",
		},
		DefaultEvents: []string{"pull_request", "issue_comment"},
	}
}

// Handler serves the one-time GitHub App creation flow on the base domain. It is
// mounted as the daemon's control handler while no App is configured. Access is
// gated by a single-use token printed to the daemon logs; the manifest callback
// is guarded by a CSRF state value.
type Handler struct {
	baseDomain string
	dataDir    string
	token      string
	state      string
	logger     *applog.Logger

	mux  *http.ServeMux
	done chan struct{}
	once sync.Once
}

// NewHandler builds the setup Handler. token gates the setup page and should be
// shown to the operator (e.g. via the daemon logs).
func NewHandler(baseDomain, dataDir, token string, logger *applog.Logger) (*Handler, error) {
	state, err := NewToken()
	if err != nil {
		return nil, err
	}
	h := &Handler{
		baseDomain: baseDomain,
		dataDir:    dataDir,
		token:      token,
		state:      state,
		logger:     logger,
		done:       make(chan struct{}),
	}
	h.mux = http.NewServeMux()
	h.mux.HandleFunc("/setup", h.page)
	h.mux.HandleFunc("/setup/create", h.create)
	h.mux.HandleFunc("/setup/callback", h.callback)
	h.mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("setup"))
	})
	h.mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/setup", http.StatusFound)
	})
	return h, nil
}

// ServeHTTP routes setup requests.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) { h.mux.ServeHTTP(w, r) }

// Done is closed once an App has been created and its credentials persisted.
func (h *Handler) Done() <-chan struct{} { return h.done }

func (h *Handler) page(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("token") != h.token {
		http.Error(w, "missing or invalid setup token (see the daemon logs)", http.StatusForbidden)
		return
	}
	if err := pageTmpl.Execute(w, map[string]string{"Token": h.token}); err != nil {
		h.logger.Error("render setup page", "err", err)
	}
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if r.FormValue("token") != h.token {
		http.Error(w, "missing or invalid setup token", http.StatusForbidden)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		name = "prevly"
	}
	org := strings.TrimSpace(r.FormValue("org"))

	redirect := "https://" + h.baseDomain + "/setup/callback"
	manifestJSON, err := json.Marshal(appManifest(name, h.baseDomain, redirect))
	if err != nil {
		http.Error(w, "encode manifest", http.StatusInternalServerError)
		return
	}
	createURL := "https://github.com/settings/apps/new?state=" + h.state
	if org != "" {
		createURL = fmt.Sprintf("https://github.com/organizations/%s/settings/apps/new?state=%s", org, h.state)
	}
	data := struct {
		CreateURL template.URL
		Manifest  string
	}{CreateURL: template.URL(createURL), Manifest: string(manifestJSON)}
	if err := submitTmpl.Execute(w, data); err != nil {
		h.logger.Error("render submit form", "err", err)
	}
}

func (h *Handler) callback(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("state") != h.state {
		http.Error(w, "state mismatch (possible CSRF)", http.StatusBadRequest)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}
	app, _, err := gh.NewClient(nil).Apps.CompleteAppManifest(r.Context(), code)
	if err != nil {
		h.logger.Error("complete app manifest", "err", err)
		http.Error(w, "could not create the GitHub App: "+err.Error(), http.StatusBadGateway)
		return
	}
	creds := Credentials{AppID: app.GetID(), WebhookSecret: app.GetWebhookSecret(), Slug: app.GetSlug()}
	if err := Save(h.dataDir, creds, []byte(app.GetPEM())); err != nil {
		h.logger.Error("persist app credentials", "err", err)
		http.Error(w, "could not save credentials", http.StatusInternalServerError)
		return
	}
	installURL := app.GetHTMLURL() + "/installations/new"
	h.logger.Info("github app created", "app_id", creds.AppID, "slug", creds.Slug, "install_url", installURL)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := successTmpl.Execute(w, map[string]string{"InstallURL": installURL}); err != nil {
		h.logger.Error("render success page", "err", err)
	}
	h.once.Do(func() { close(h.done) })
}

var (
	pageTmpl = template.Must(template.New("page").Parse(`<!doctype html>
<html><head><meta charset="utf-8"><title>prevly setup</title></head>
<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:3rem auto;line-height:1.5">
<h1>prevly — create your GitHub App</h1>
<p>This creates a GitHub App so prevly can receive pull-request events and post
preview URLs. You only do this once.</p>
<form method="POST" action="/setup/create">
  <input type="hidden" name="token" value="{{.Token}}">
  <p><label>App name<br><input name="name" value="prevly" required style="width:100%;padding:.4rem"></label></p>
  <p><label>GitHub organization (optional)<br><input name="org" placeholder="leave blank to use your account" style="width:100%;padding:.4rem"></label></p>
  <p><button type="submit" style="padding:.5rem 1rem">Create GitHub App</button></p>
</form>
<p style="color:#666;font-size:.9rem">You must be an owner (or GitHub App manager) of the organization to create it there.</p>
</body></html>`))

	submitTmpl = template.Must(template.New("submit").Parse(`<!doctype html>
<html><body onload="document.forms[0].submit()">
<p>Redirecting you to GitHub…</p>
<form action="{{.CreateURL}}" method="post">
  <input type="hidden" name="manifest" value="{{.Manifest}}">
  <noscript><button type="submit">Continue to GitHub</button></noscript>
</form>
</body></html>`))

	successTmpl = template.Must(template.New("success").Parse(`<!doctype html>
<html><head><meta charset="utf-8"><title>prevly</title></head>
<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:3rem auto;line-height:1.5">
<h1>GitHub App created ✔</h1>
<p>Last step: <a href="{{.InstallURL}}">install the App on your repository</a>
(choose only the repos you want previews for).</p>
<p>prevly is now switching to normal mode — you can close this tab.</p>
</body></html>`))
)
