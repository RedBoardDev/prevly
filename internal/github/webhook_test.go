package github

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifySignature(t *testing.T) {
	t.Parallel()
	secret := "topsecret"
	body := []byte(`{"action":"opened"}`)
	good := sign(secret, body)

	if err := VerifySignature(secret, body, good); err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	if err := VerifySignature(secret, body, sign("wrong", body)); !errors.Is(err, ErrInvalidSignature) {
		t.Fatalf("wrong-secret signature should be invalid, got %v", err)
	}
	if err := VerifySignature(secret, []byte("tampered"), good); !errors.Is(err, ErrInvalidSignature) {
		t.Fatalf("tampered body should be invalid, got %v", err)
	}
	if err := VerifySignature(secret, body, "deadbeef"); !errors.Is(err, ErrInvalidSignature) {
		t.Fatalf("missing prefix should be invalid, got %v", err)
	}
	if err := VerifySignature("", body, good); err == nil {
		t.Fatal("empty secret must error")
	}
}
