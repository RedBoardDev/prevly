package github

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/bradleyfalzon/ghinstallation/v2"
	gh "github.com/google/go-github/v66/github"
)

// App holds the GitHub App identity and mints short-lived installation tokens.
// Tokens are never persisted; each installation gets its own scoped transport.
type App struct {
	appID    int64
	appsTr   *ghinstallation.AppsTransport
	baseHTTP http.RoundTripper
}

// NewApp builds an App from its numeric id and PEM-encoded private key.
func NewApp(appID int64, privateKeyPEM []byte) (*App, error) {
	base := http.DefaultTransport
	atr, err := ghinstallation.NewAppsTransport(base, appID, privateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("github app transport: %w", err)
	}
	return &App{appID: appID, appsTr: atr, baseHTTP: base}, nil
}

// NewAppFromFile builds an App reading the private key from a PEM file.
func NewAppFromFile(appID int64, pemPath string) (*App, error) {
	pem, err := os.ReadFile(pemPath)
	if err != nil {
		return nil, fmt.Errorf("read github app key: %w", err)
	}
	return NewApp(appID, pem)
}

func (a *App) installationTransport(installationID int64) *ghinstallation.Transport {
	return ghinstallation.NewFromAppsTransport(a.appsTr, installationID)
}

// Client returns a go-github client scoped to a single installation.
func (a *App) Client(installationID int64) *gh.Client {
	tr := a.installationTransport(installationID)
	return gh.NewClient(&http.Client{Transport: tr})
}

// InstallationToken mints a short-lived installation access token, used to
// authenticate `git clone` of the PR head.
func (a *App) InstallationToken(ctx context.Context, installationID int64) (string, error) {
	tr := a.installationTransport(installationID)
	tok, err := tr.Token(ctx)
	if err != nil {
		return "", fmt.Errorf("installation token: %w", err)
	}
	return tok, nil
}
