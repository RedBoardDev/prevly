package ingress

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// Injector decides what to inject for a preview host. tag is inserted before
// the last </body> (or </html>, or appended when both are absent) into
// text/html 200 responses. ok=false means leave the response untouched.
type Injector interface {
	InjectTag(host string) (tag string, ok bool)
}

// SetInjector enables HTML tag injection on proxied responses.
func (p *Proxy) SetInjector(i Injector) { p.injector = i }

const maxInjectBody = 8 << 20

var (
	bodyClose = []byte("</body>")
	htmlClose = []byte("</html>")
)

func (p *Proxy) modifyResponse(resp *http.Response) error {
	if p.injector == nil || resp.Request == nil {
		return nil
	}
	if resp.StatusCode != http.StatusOK || resp.Request.Method != http.MethodGet {
		return nil
	}
	if !isHTML(resp.Header.Get("Content-Type")) {
		return nil
	}
	// We never decode: splicing a tag into a gzip/br stream ships a page the
	// browser cannot decompress.
	if resp.Header.Get("Content-Encoding") != "" {
		return nil
	}
	if resp.ContentLength > maxInjectBody {
		return nil
	}
	tag, ok := p.injector.InjectTag(hostOnly(resp.Request.Host))
	if !ok || tag == "" {
		return nil
	}

	body, rest, err := readCapped(resp.Body, maxInjectBody)
	if err != nil {
		return err
	}
	if rest != nil {
		resp.Body = rest
		return nil
	}

	out := spliceTag(body, tag)
	resp.Body = io.NopCloser(bytes.NewReader(out))
	resp.ContentLength = int64(len(out))
	resp.Header.Set("Content-Length", strconv.Itoa(len(out)))
	resp.Header.Del("Content-Encoding")
	return nil
}

// readCapped buffers up to limit bytes. Past the limit it returns a nil buffer
// and a ReadCloser replaying what was consumed followed by the untouched rest.
func readCapped(rc io.ReadCloser, limit int64) ([]byte, io.ReadCloser, error) {
	buf, err := io.ReadAll(io.LimitReader(rc, limit+1))
	if err != nil {
		return nil, nil, err
	}
	if int64(len(buf)) > limit {
		// Dropping buf here would truncate the page: it is already off the wire.
		return nil, &joinedBody{r: io.MultiReader(bytes.NewReader(buf), rc), c: rc}, nil
	}
	// The upstream connection is only returned to the pool on Close, and the
	// replacement body's Close does not reach this one.
	_ = rc.Close()
	return buf, nil, nil
}

type joinedBody struct {
	r io.Reader
	c io.Closer
}

func (b *joinedBody) Read(p []byte) (int, error) { return b.r.Read(p) }
func (b *joinedBody) Close() error               { return b.c.Close() }

func spliceTag(body []byte, tag string) []byte {
	at := lastIndexFold(body, bodyClose)
	if at < 0 {
		at = lastIndexFold(body, htmlClose)
	}
	if at < 0 {
		return append(body, tag...)
	}
	out := make([]byte, 0, len(body)+len(tag))
	out = append(out, body[:at]...)
	out = append(out, tag...)
	return append(out, body[at:]...)
}

func lastIndexFold(b, needle []byte) int {
	for i := len(b) - len(needle); i >= 0; i-- {
		if b[i] != '<' {
			continue
		}
		if bytes.EqualFold(b[i:i+len(needle)], needle) {
			return i
		}
	}
	return -1
}

func isHTML(contentType string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "text/html")
}

func acceptsHTML(accept string) bool {
	accept = strings.TrimSpace(accept)
	if accept == "" || accept == "*/*" {
		return true
	}
	return strings.Contains(strings.ToLower(accept), "text/html")
}
