package api

import (
	"crypto/rand"
	"encoding/hex"
)

// randomHexID generates a cryptographically secure random hexadecimal string of 2*n hex characters.
func randomHexID(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
