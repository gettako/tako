package audit

import (
	"crypto/rand"
	"time"
)

// crockfordEncoding defines Crockford's Base32 alphabet.
const crockfordEncoding = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// NewULID generates a 26-character Crockford Base32 ULID.
// The first 10 characters encode a 48-bit millisecond timestamp.
// The remaining 16 characters encode 80 bits of cryptographic entropy.
func NewULID() string {
	return NewULIDAt(time.Now().UTC())
}

// NewULIDAt generates a ULID for a specific timestamp.
func NewULIDAt(t time.Time) string {
	ms := uint64(t.UnixMilli())

	var entropy [10]byte
	_, _ = rand.Read(entropy[:])

	var dst [26]byte

	// 48-bit timestamp encoded as 10 Crockford Base32 characters
	dst[0] = crockfordEncoding[(ms>>45)&31]
	dst[1] = crockfordEncoding[(ms>>40)&31]
	dst[2] = crockfordEncoding[(ms>>35)&31]
	dst[3] = crockfordEncoding[(ms>>30)&31]
	dst[4] = crockfordEncoding[(ms>>25)&31]
	dst[5] = crockfordEncoding[(ms>>20)&31]
	dst[6] = crockfordEncoding[(ms>>15)&31]
	dst[7] = crockfordEncoding[(ms>>10)&31]
	dst[8] = crockfordEncoding[(ms>>5)&31]
	dst[9] = crockfordEncoding[ms&31]

	// 80 bits of entropy encoded as 16 Crockford Base32 characters
	dst[10] = crockfordEncoding[(entropy[0]>>3)&31]
	dst[11] = crockfordEncoding[((entropy[0]&7)<<2)|(entropy[1]>>6)]
	dst[12] = crockfordEncoding[(entropy[1]>>1)&31]
	dst[13] = crockfordEncoding[((entropy[1]&1)<<4)|(entropy[2]>>4)]
	dst[14] = crockfordEncoding[((entropy[2]&15)<<1)|(entropy[3]>>7)]
	dst[15] = crockfordEncoding[(entropy[3]>>2)&31]
	dst[16] = crockfordEncoding[((entropy[3]&3)<<3)|(entropy[4]>>5)]
	dst[17] = crockfordEncoding[entropy[4]&31]
	dst[18] = crockfordEncoding[(entropy[5]>>3)&31]
	dst[19] = crockfordEncoding[((entropy[5]&7)<<2)|(entropy[6]>>6)]
	dst[20] = crockfordEncoding[(entropy[6]>>1)&31]
	dst[21] = crockfordEncoding[((entropy[6]&1)<<4)|(entropy[7]>>4)]
	dst[22] = crockfordEncoding[((entropy[7]&15)<<1)|(entropy[8]>>7)]
	dst[23] = crockfordEncoding[(entropy[8]>>2)&31]
	dst[24] = crockfordEncoding[((entropy[8]&3)<<3)|(entropy[9]>>5)]
	dst[25] = crockfordEncoding[entropy[9]&31]

	return string(dst[:])
}
