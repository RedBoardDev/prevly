package reconcile

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/RedBoardDev/prevly/internal/builder"
	"github.com/RedBoardDev/prevly/internal/config"
	gh "github.com/RedBoardDev/prevly/internal/github"
	"github.com/RedBoardDev/prevly/internal/model"
	"github.com/RedBoardDev/prevly/internal/runtime"
)

// errCapacity is returned when the max concurrent previews limit is reached.
var errCapacity = errors.New("max concurrent previews reached")

// deployApp builds and runs (or rebuilds) one app's preview for a PR, updating
// the store and PR feedback as it progresses.
func (r *Reconciler) deployApp(ctx context.Context, ev *gh.PullRequestEvent, repoCfg *config.RepoConfig, app config.AppConfig) error {
	host := repoCfg.Host(r.cfg.BaseDomain, ev.Number, app)
	url := "https://" + host

	existing, _ := r.store.Get(ev.Repo, ev.Number, app.Name)
	if existing == nil {
		if err := r.checkCapacity(); err != nil {
			return err
		}
	}

	p := r.upsertBuilding(ev, repoCfg, app, host, url, existing)
	if err := r.store.Put(p); err != nil {
		return err
	}
	r.publish(ctx, ev, p)

	imageTag := model.ImageTag(ev.Repo, app.Name, ev.Number, ev.HeadSHA)
	if err := r.buildImage(ctx, ev, app, imageTag); err != nil {
		p.Status = model.StatusFailed
		p.FailureLog = lastLines(err.Error(), 30)
		_ = r.store.Put(p)
		r.publish(ctx, ev, p)
		return err
	}

	if err := r.runContainer(ctx, ev, app, p, imageTag); err != nil {
		p.Status = model.StatusFailed
		p.FailureLog = lastLines(err.Error(), 30)
		_ = r.store.Put(p)
		r.publish(ctx, ev, p)
		return err
	}

	p.Status = model.StatusRunning
	p.ImageTag = imageTag
	p.CommitSHA = ev.HeadSHA
	p.LastSeenAt = r.now()
	if err := r.store.Put(p); err != nil {
		return err
	}
	r.publish(ctx, ev, p)
	r.logger.Info("preview deployed", "repo", ev.Repo, "pr", ev.Number, "app", app.Name, "url", url)
	return nil
}

func (r *Reconciler) upsertBuilding(ev *gh.PullRequestEvent, repoCfg *config.RepoConfig, app config.AppConfig, host, url string, existing *model.Preview) *model.Preview {
	p := existing
	if p == nil {
		p = &model.Preview{
			Repo:      ev.Repo,
			PRNumber:  ev.Number,
			AppName:   app.Name,
			Subdomain: app.Subdomain,
			CreatedAt: r.now(),
			Port:      app.Port,
		}
	}
	p.Host = host
	p.URL = url
	p.Status = model.StatusBuilding
	p.TTL = r.ttlFor(repoCfg)
	p.Idle = r.idleFor(repoCfg)
	if p.LastSeenAt.IsZero() {
		p.LastSeenAt = r.now()
	}
	return p
}

func (r *Reconciler) buildImage(ctx context.Context, ev *gh.PullRequestEvent, app config.AppConfig, imageTag string) error {
	r.buildSem <- struct{}{}
	defer func() { <-r.buildSem }()

	token, err := r.gh.CloneToken(ctx, ev.InstallationID)
	if err != nil {
		return err
	}
	checkoutDir := filepath.Join(r.workDir, model.ContainerName(ev.Repo, ev.Number, app.Name))
	if err := r.builder.Checkout(ctx, builder.CheckoutOptions{
		CloneURL: ev.CloneURL,
		SHA:      ev.HeadSHA,
		Token:    token,
		Dir:      checkoutDir,
	}); err != nil {
		return err
	}

	contextDir := filepath.Join(checkoutDir, app.Context)
	_, err = r.builder.Build(ctx, builder.BuildSpec{
		ContextDir: contextDir,
		Dockerfile: app.Dockerfile,
		ImageTag:   imageTag,
		BuildArgs:  app.BuildArgs,
	})
	return err
}

func (r *Reconciler) runContainer(ctx context.Context, ev *gh.PullRequestEvent, app config.AppConfig, p *model.Preview, imageTag string) error {
	secs, err := r.secrets.Resolve(app.Secrets)
	if err != nil {
		return err
	}
	network := model.NetworkName(ev.Repo, ev.Number, app.Name)
	if err := r.runtime.EnsureNetwork(ctx, network); err != nil {
		return err
	}
	// Replace any previous container on redeploy.
	if p.ContainerID != "" {
		_ = r.runtime.Remove(ctx, p.ContainerID)
	}

	spec := runtime.RunSpec{
		Name:          model.ContainerName(ev.Repo, ev.Number, app.Name),
		Image:         imageTag,
		Network:       network,
		ContainerPort: app.Port,
		Env:           app.Env,
		Secrets:       secs,
		Limits:        r.cfg.Limits.PerPreview,
		Labels:        previewLabels(ev.Repo, ev.Number, app.Name),
	}
	id, hostPort, err := r.runtime.Run(ctx, spec)
	if err != nil {
		return err
	}
	p.ContainerID = id
	p.Port = hostPort
	p.NetworkName = network
	return nil
}

func previewLabels(repo string, pr int, app string) map[string]string {
	return map[string]string{
		model.LabelManaged: "true",
		model.LabelRepo:    repo,
		model.LabelPR:      fmt.Sprintf("%d", pr),
		model.LabelApp:     app,
	}
}

// teardownPreview destroys a single preview's container, network and image and
// removes its record.
func (r *Reconciler) teardownPreview(ctx context.Context, p *model.Preview) error {
	if p.ContainerID != "" {
		_ = r.runtime.Remove(ctx, p.ContainerID)
	}
	if p.NetworkName != "" {
		_ = r.runtime.RemoveNetwork(ctx, p.NetworkName)
	}
	if p.ImageTag != "" {
		_ = r.runtime.RemoveImage(ctx, p.ImageTag)
	}
	r.logger.Info("preview destroyed", "repo", p.Repo, "pr", p.PRNumber, "app", p.AppName)
	return r.store.Delete(p.Repo, p.PRNumber, p.AppName)
}

// Teardown destroys a PR's previews (or one app). Exposed for the admin CLI.
func (r *Reconciler) Teardown(ctx context.Context, repo string, pr int, app string) (int, error) {
	return r.teardownPR(ctx, repo, pr, app)
}

// teardownPR destroys all previews for a PR (or one app when app != "").
func (r *Reconciler) teardownPR(ctx context.Context, repo string, pr int, app string) (int, error) {
	previews, err := r.store.ListByPR(repo, pr)
	if err != nil {
		return 0, err
	}
	var n int
	for _, p := range previews {
		if app != "" && p.AppName != app {
			continue
		}
		if err := r.teardownPreview(ctx, p); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

func (r *Reconciler) checkCapacity() error {
	previews, err := r.store.List()
	if err != nil {
		return err
	}
	var active int
	for _, p := range previews {
		if p.Status != model.StatusDestroyed {
			active++
		}
	}
	if active >= r.cfg.Limits.MaxConcurrentPreviews {
		return errCapacity
	}
	return nil
}

func lastLines(s string, n int) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	if len(lines) <= n {
		return s
	}
	return strings.Join(lines[len(lines)-n:], "\n")
}
