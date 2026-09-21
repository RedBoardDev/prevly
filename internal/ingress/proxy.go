package ingress

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/caddyserver/certmagic"

	"github.com/RedBoardDev/prevly/internal/config"
	applog "github.com/RedBoardDev/prevly/internal/log"
)

// Proxy is the embedded reverse proxy + CertMagic TLS terminator.
type Proxy struct {
	resolver   Resolver
	baseDomain string
	tls        config.TLSConfig
	httpAddr   string
	httpsAddr  string
	dataDir    string
	logger     *applog.Logger

	// control serves requests addressed to the base domain (webhooks, health),
	// distinct from preview hosts.
	control http.Handler

	// previewHandler answers previewPrefix paths on preview hosts without
	// resolving the upstream.
	previewPrefix  string
	previewHandler http.Handler

	injector Injector

	rp *httputil.ReverseProxy
}

// SetControlHandler registers the handler for requests to the base domain
// (e.g. the GitHub webhook endpoint).
func (p *Proxy) SetControlHandler(h http.Handler) { p.control = h }

// SetPreviewPathHandler routes requests on preview hosts whose path starts with
// prefix to h, before resolving (and so without waking) the upstream. The
// request reaches h unchanged (Host header = preview host).
func (p *Proxy) SetPreviewPathHandler(prefix string, h http.Handler) {
	p.previewPrefix = prefix
	p.previewHandler = h
}

// NewProxy builds a Proxy. dataDir is where CertMagic stores certificates.
func NewProxy(resolver Resolver, cfg *config.HostConfig, logger *applog.Logger) *Proxy {
	p := &Proxy{
		resolver:   resolver,
		baseDomain: cfg.BaseDomain,
		tls:        cfg.TLS,
		httpAddr:   cfg.HTTPAddr,
		httpsAddr:  cfg.HTTPSAddr,
		dataDir:    cfg.DataDir,
		logger:     logger,
	}
	p.rp = &httputil.ReverseProxy{
		Rewrite:        p.rewrite,
		ModifyResponse: p.modifyResponse,
		ErrorHandler:   p.proxyError,
	}
	return p
}

// Publish returns the externally reachable URL for a host.
func (p *Proxy) Publish(host string) string {
	return "https://" + host
}

type ctxKey int

const upstreamKey ctxKey = 0

func (p *Proxy) rewrite(r *httputil.ProxyRequest) {
	upstream, _ := r.In.Context().Value(upstreamKey).(string)
	r.SetURL(&url.URL{Scheme: "http", Host: upstream})
	r.SetXForwarded()
	r.Out.Host = r.In.Host
	// A compressed upstream answer is passed through untouched, so a page that
	// should carry the injected tag would silently lose it.
	if p.injector != nil && acceptsHTML(r.In.Header.Get("Accept")) {
		r.Out.Header.Del("Accept-Encoding")
	}
}

func (p *Proxy) proxyError(w http.ResponseWriter, _ *http.Request, err error) {
	p.logger.Warn("proxy upstream error", "err", err)
	http.Error(w, "preview upstream unavailable", http.StatusBadGateway)
}

// ServeHTTP resolves the host to an upstream (waking it if asleep) and proxies.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	host := hostOnly(r.Host)
	if host == p.baseDomain && p.control != nil {
		p.control.ServeHTTP(w, r)
		return
	}
	if host != p.baseDomain && p.previewHandler != nil && strings.HasPrefix(r.URL.Path, p.previewPrefix) {
		p.previewHandler.ServeHTTP(w, r)
		return
	}
	target, ok, err := p.resolver.Resolve(r.Context(), host)
	if err != nil {
		p.logger.Error("resolve preview", "host", host, "err", err)
		http.Error(w, "preview error", http.StatusBadGateway)
		return
	}
	if !ok {
		http.Error(w, "no preview for "+host, http.StatusNotFound)
		return
	}
	ctx := context.WithValue(r.Context(), upstreamKey, target.Upstream)
	p.rp.ServeHTTP(w, r.WithContext(ctx))
}

// Run configures CertMagic and serves HTTP (ACME + redirect) and HTTPS until
// ctx is cancelled.
func (p *Proxy) Run(ctx context.Context) error {
	if p.tls.Mode == config.TLSModeExternal {
		return p.runCleartext(ctx)
	}
	magic, issuer, err := p.certmagic(ctx)
	if err != nil {
		return err
	}

	if p.tls.Mode == config.TLSModeDNS01 {
		// Obtain the apex and wildcard certs one at a time, in the background so
		// serving starts immediately. Both validate via the same
		// _acme-challenge.<base_domain> DNS record, so issuing them concurrently
		// races on the Route53 record set (one challenge clobbers the other).
		// Serialized issuance avoids that. The apex is obtained first since it
		// serves the webhook and setup endpoints; the wildcard covers previews.
		go func() {
			for _, d := range []string{p.baseDomain, "*." + p.baseDomain} {
				if err := magic.ManageSync(ctx, []string{d}); err != nil {
					p.logger.Error("obtain certificate", "domain", d, "err", err)
				}
			}
		}()
	}

	tlsConf := magic.TLSConfig()
	tlsConf.NextProtos = append([]string{"h2", "http/1.1"}, tlsConf.NextProtos...)

	httpsSrv := &http.Server{
		Addr:              p.httpsAddr,
		Handler:           p,
		TLSConfig:         tlsConf,
		ReadHeaderTimeout: 10 * time.Second,
	}
	httpSrv := &http.Server{
		Addr:              p.httpAddr,
		Handler:           issuer.HTTPChallengeHandler(http.HandlerFunc(redirectToHTTPS)),
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 2)
	go func() { errCh <- serveHTTP(httpSrv) }()
	go func() { errCh <- serveHTTPS(httpsSrv) }()

	p.logger.Info("ingress listening", "http", p.httpAddr, "https", p.httpsAddr, "tls", p.tls.Mode)

	select {
	case <-ctx.Done():
		shutdown(httpSrv)
		shutdown(httpsSrv)
		return nil
	case err := <-errCh:
		shutdown(httpSrv)
		shutdown(httpsSrv)
		return err
	}
}

// runCleartext serves the proxy itself over plain HTTP on httpAddr, for a
// terminating proxy in front (Caddy, nginx, an ALB) that preserves the Host
// header. It must not install redirectToHTTPS: the front end forwards over
// HTTP, so a redirect to https sends the request back through it, forever.
func (p *Proxy) runCleartext(ctx context.Context) error {
	srv := &http.Server{
		Addr:              p.httpAddr,
		Handler:           p,
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() { errCh <- serveHTTP(srv) }()

	p.logger.Info("ingress listening", "http", p.httpAddr, "tls", p.tls.Mode)

	select {
	case <-ctx.Done():
		shutdown(srv)
		return nil
	case err := <-errCh:
		shutdown(srv)
		return err
	}
}

func (p *Proxy) certmagic(_ context.Context) (*certmagic.Config, *certmagic.ACMEIssuer, error) {
	certmagic.Default.Storage = &certmagic.FileStorage{Path: p.dataDir + "/certs"}
	magic := certmagic.NewDefault()

	tmpl := certmagic.ACMEIssuer{Email: p.tls.Email, Agreed: true}
	switch p.tls.Mode {
	case config.TLSModeDNS01:
		provider, err := dnsProvider(p.tls.Provider)
		if err != nil {
			return nil, nil, err
		}
		// Route53 is eventually consistent across its authoritative nameservers,
		// and Let's Encrypt validates from multiple perspectives. Wait for the
		// challenge record to propagate before asking ACME to validate, else
		// secondary validation can fail with "No TXT record found".
		tmpl.DNS01Solver = &certmagic.DNS01Solver{DNSManager: certmagic.DNSManager{
			DNSProvider:        provider,
			PropagationDelay:   30 * time.Second,
			PropagationTimeout: 5 * time.Minute,
		}}
	case config.TLSModeOnDemand:
		magic.OnDemand = &certmagic.OnDemandConfig{DecisionFunc: p.onDemandDecision}
	default:
		return nil, nil, fmt.Errorf("unsupported tls mode %q", p.tls.Mode)
	}

	issuer := certmagic.NewACMEIssuer(magic, tmpl)
	magic.Issuers = []certmagic.Issuer{issuer}
	return magic, issuer, nil
}

// onDemandDecision gates on-demand issuance: only mint a certificate for a host
// that maps to a known preview, to prevent abuse.
func (p *Proxy) onDemandDecision(_ context.Context, name string) error {
	host := hostOnly(name)
	if host == p.baseDomain {
		return nil
	}
	if !p.resolver.Known(host) {
		return fmt.Errorf("no preview for host %q", name)
	}
	return nil
}

func redirectToHTTPS(w http.ResponseWriter, r *http.Request) {
	target := "https://" + hostOnly(r.Host) + r.URL.RequestURI()
	http.Redirect(w, r, target, http.StatusMovedPermanently)
}

func serveHTTP(s *http.Server) error {
	if err := s.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func serveHTTPS(s *http.Server) error {
	if err := s.ListenAndServeTLS("", ""); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func shutdown(s *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = s.Shutdown(ctx)
}

func hostOnly(hostport string) string {
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		return h
	}
	return hostport
}
