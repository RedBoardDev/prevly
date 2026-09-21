package feedback

import (
	"math"
	"sync"
	"time"
)

// limiter is a per-host token bucket sized and refilled at maxPerHour reports
// per hour. A non-positive rate means unlimited.
type limiter struct {
	mu      sync.Mutex
	rate    int
	now     func() time.Time
	buckets map[string]*bucket
}

type bucket struct {
	tokens float64
	at     time.Time
}

func newLimiter(maxPerHour int, now func() time.Time) *limiter {
	return &limiter{rate: maxPerHour, now: now, buckets: map[string]*bucket{}}
}

// allow consumes one token for host. When it returns false, retry is how long
// the caller must wait before a token is available again.
func (l *limiter) allow(host string) (ok bool, retry time.Duration) {
	if l.rate <= 0 {
		return true, 0
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	perSecond := float64(l.rate) / 3600
	b, seen := l.buckets[host]
	if !seen {
		b = &bucket{tokens: float64(l.rate), at: now}
		l.buckets[host] = b
	} else {
		b.tokens = math.Min(float64(l.rate), b.tokens+now.Sub(b.at).Seconds()*perSecond)
		b.at = now
	}
	if b.tokens < 1 {
		wait := time.Duration((1 - b.tokens) / perSecond * float64(time.Second))
		return false, max(wait, time.Second)
	}
	b.tokens--
	return true, 0
}
