package feedback

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/RedBoardDev/prevly/internal/config"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/store"
)

func writeScreenshot(t *testing.T, dir, id string, modTime time.Time) string {
	t.Helper()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	path := filepath.Join(dir, id+".png")
	if err := os.WriteFile(path, pngBytes(), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := os.Chtimes(path, modTime, modTime); err != nil {
		t.Fatalf("chtimes: %v", err)
	}
	return path
}

func TestTickGivesUpAfterMaxAttempts(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	f.gh.err = errors.New("github down")

	if rec := post(t, f.svc.PreviewHandler(), previewHost, validMeta(), nil); rec.Code != 201 {
		t.Fatalf("status = %d", rec.Code)
	}
	for range maxPostAttempts + 3 {
		f.svc.Tick(context.Background())
	}
	unposted, err := f.store.ListFeedbackUnposted()
	if err != nil {
		t.Fatalf("list unposted: %v", err)
	}
	if len(unposted) != 1 || unposted[0].PostAttempts != maxPostAttempts {
		t.Fatalf("attempts must stop at %d: %+v", maxPostAttempts, unposted)
	}
}

func TestTickSweepsExpiredScreenshots(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	cfg.Retention = config.Duration(24 * time.Hour)
	f := newFixture(t, cfg)

	rec := post(t, f.svc.PreviewHandler(), previewHost, validMeta(), pngBytes())
	fresh, _ := decodeItem(t, rec.Body.Bytes())["id"].(string)

	old := "0000000000000000000000000"[:idLen-1] + "1"
	oldPath := writeScreenshot(t, f.dir, old, time.Now().Add(-48*time.Hour))
	recentOrphan := "0000000000000000000000000"[:idLen-1] + "2"
	recentPath := writeScreenshot(t, f.dir, recentOrphan, time.Now())

	f.svc.Tick(context.Background())

	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("an orphan file past retention must be swept: %v", err)
	}
	if _, err := os.Stat(recentPath); err != nil {
		t.Fatalf("a recent orphan file must survive: %v", err)
	}
	if _, err := os.Stat(filepath.Join(f.dir, fresh+".png")); err != nil {
		t.Fatalf("a live report's screenshot must survive: %v", err)
	}
}

func TestTickKeepsFilesWhenRecordIsRecent(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	cfg.Retention = config.Duration(24 * time.Hour)
	f := newFixture(t, cfg)

	rec := post(t, f.svc.PreviewHandler(), previewHost, validMeta(), pngBytes())
	id, _ := decodeItem(t, rec.Body.Bytes())["id"].(string)
	// An old file whose record is recent: the record wins.
	path := writeScreenshot(t, f.dir, id, time.Now().Add(-72*time.Hour))

	f.svc.Tick(context.Background())

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("file must follow its record's age: %v", err)
	}
}

func TestOnTeardownDropsRecordsKeepsFiles(t *testing.T) {
	t.Parallel()
	f := newFixture(t, defaultConfig())
	rec := post(t, f.svc.PreviewHandler(), previewHost, validMeta(), pngBytes())
	id, _ := decodeItem(t, rec.Body.Bytes())["id"].(string)

	if err := f.svc.OnTeardown("org/repo", 42, "web"); err != nil {
		t.Fatalf("teardown: %v", err)
	}
	if _, err := f.store.GetFeedback(id); !errors.Is(err, store.ErrFeedbackNotFound) {
		t.Fatalf("record must be gone, got %v", err)
	}
	if _, err := os.Stat(filepath.Join(f.dir, id+".png")); err != nil {
		t.Fatalf("screenshot file must outlive the record: %v", err)
	}
}

func TestInjectTag(t *testing.T) {
	t.Parallel()
	sleeping := livePreview()
	sleeping.Status = model.StatusSleeping

	building := livePreview()
	building.PRNumber = 43
	building.Host = "pr-43-web.preview.example.com"
	building.Status = model.StatusBuilding

	optedOut := livePreview()
	optedOut.PRNumber = 44
	optedOut.Host = "pr-44-web.preview.example.com"
	optedOut.FeedbackEnabled = false

	f := newFixture(t, defaultConfig(), sleeping, building, optedOut)

	tag, ok := f.svc.InjectTag(previewHost)
	if !ok || tag != scriptTag {
		t.Fatalf("sleeping preview: tag = %q ok = %v", tag, ok)
	}
	if _, ok := f.svc.InjectTag(previewHost + ":443"); !ok {
		t.Fatal("a Host header with a port must still resolve")
	}
	for _, host := range []string{building.Host, optedOut.Host, "nobody.preview.example.com"} {
		if _, ok := f.svc.InjectTag(host); ok {
			t.Fatalf("%s must not be injected", host)
		}
	}

	off := newFixture(t, config.FeedbackConfig{Enabled: new(bool), MaxPerHour: 30})
	if _, ok := off.svc.InjectTag(previewHost); ok {
		t.Fatal("injection must be off when feedback is disabled host-wide")
	}
}
