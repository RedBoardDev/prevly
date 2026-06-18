package setup

import (
	"bytes"
	"testing"
)

func TestLoadMissingIsNotAnError(t *testing.T) {
	t.Parallel()
	_, _, ok, err := Load(t.TempDir())
	if err != nil {
		t.Fatalf("Load on empty dir: unexpected error %v", err)
	}
	if ok {
		t.Fatal("Load on empty dir: ok should be false")
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	want := Credentials{AppID: 4242, WebhookSecret: "s3cr3t", Slug: "prevly-kare"}
	key := []byte("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n")

	if err := Save(dir, want, key); err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, gotKey, ok, err := Load(dir)
	if err != nil || !ok {
		t.Fatalf("Load: ok=%v err=%v", ok, err)
	}
	if got != want {
		t.Fatalf("credentials = %+v, want %+v", got, want)
	}
	if !bytes.Equal(gotKey, key) {
		t.Fatalf("private key round-trip mismatch")
	}
}

func TestNewTokenIsRandomHex(t *testing.T) {
	t.Parallel()
	a, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	b, _ := NewToken()
	if a == b {
		t.Fatal("NewToken returned identical tokens")
	}
	if len(a) != 32 { // 16 random bytes hex-encoded
		t.Fatalf("token length = %d, want 32", len(a))
	}
}
