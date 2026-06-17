// Package github integrates prevly with the GitHub App: webhook verification
// and parsing, App authentication (installation tokens), repository API calls
// used by the orchestrator, and ChatOps command parsing.
package github

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

// ErrInvalidSignature is returned when an HMAC check fails.
var ErrInvalidSignature = errors.New("invalid webhook signature")

// VerifySignature validates the X-Hub-Signature-256 header against the payload
// using the webhook secret (HMAC-SHA256). The comparison is constant-time.
func VerifySignature(secret string, body []byte, signatureHeader string) error {
	if secret == "" {
		return errors.New("webhook secret is empty")
	}
	const prefix = "sha256="
	hexSig, ok := strings.CutPrefix(signatureHeader, prefix)
	if !ok {
		return fmt.Errorf("%w: missing sha256= prefix", ErrInvalidSignature)
	}
	want, err := hex.DecodeString(hexSig)
	if err != nil {
		return fmt.Errorf("%w: malformed hex", ErrInvalidSignature)
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	got := mac.Sum(nil)
	if !hmac.Equal(got, want) {
		return ErrInvalidSignature
	}
	return nil
}
