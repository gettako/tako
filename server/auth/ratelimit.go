package auth

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	loginRateLimitMax    = 10            // max failed attempts
	loginRateLimitWindow = 10 * time.Minute // sliding window duration
)

// loginFailEntry tracks failed login attempts for a single IP using a
// sliding window: only attempts within the last loginRateLimitWindow count.
type loginFailEntry struct {
	mu        sync.Mutex
	attempts  []time.Time // timestamps of failed attempts, oldest first
}

// loginRateLimiter stores per-IP failure state in a sync.Map.
// Keys are plain IP strings (no port); values are *loginFailEntry.
type loginRateLimiter struct {
	state sync.Map
}

// newLoginRateLimiter constructs a ready-to-use limiter.
func newLoginRateLimiter() *loginRateLimiter {
	return &loginRateLimiter{}
}

// entry returns the loginFailEntry for ip, creating it on first access.
func (l *loginRateLimiter) entry(ip string) *loginFailEntry {
	v, _ := l.state.LoadOrStore(ip, &loginFailEntry{})
	return v.(*loginFailEntry)
}

// allow reports whether a new attempt from ip is permitted.
// It does NOT record a failure — call recordFailure / resetIP separately.
// Returns (allowed=true, retryAfter=0) when under the limit.
// Returns (allowed=false, retryAfter=<seconds until oldest attempt expires>) when over.
func (l *loginRateLimiter) allow(ip string) (allowed bool, retryAfter int) {
	e := l.entry(ip)
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-loginRateLimitWindow)

	// Drop expired attempts (sliding window).
	valid := e.attempts[:0]
	for _, t := range e.attempts {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	e.attempts = valid

	if len(e.attempts) < loginRateLimitMax {
		return true, 0
	}

	// Oldest attempt in window determines when the window reopens.
	oldest := e.attempts[0]
	retryAt := oldest.Add(loginRateLimitWindow)
	secs := int(time.Until(retryAt).Seconds()) + 1 // round up
	if secs < 1 {
		secs = 1
	}
	return false, secs
}

// recordFailure appends now to ip's failure list.
func (l *loginRateLimiter) recordFailure(ip string) {
	e := l.entry(ip)
	e.mu.Lock()
	defer e.mu.Unlock()
	e.attempts = append(e.attempts, time.Now())
}

// resetIP clears all recorded failures for ip (called on successful login).
func (l *loginRateLimiter) resetIP(ip string) {
	l.state.Delete(ip)
}

// clientIP extracts just the IP address from an *http.Request.
// It respects X-Forwarded-For and X-Real-IP for reverse-proxy deployments.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if ip, _, err := net.SplitHostPort(strings.TrimSpace(strings.Split(xff, ",")[0])); err == nil {
			return ip
		}
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
