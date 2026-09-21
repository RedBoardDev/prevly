package feedback

import (
	"crypto/rand"
	"fmt"
	"time"
)

// crockford is the Crockford base32 alphabet: no I, L, O or U, so an id is
// URL-safe and hard to mistranscribe.
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// idLen is the encoded length of a 16-byte id (6-byte timestamp + 10 random).
const idLen = 26

// NewID returns a time-ordered, URL-safe unique id: a 6-byte millisecond
// timestamp followed by 10 random bytes, in Crockford base32. Lexicographic
// order matches creation order.
func NewID(now time.Time) (string, error) {
	var b [16]byte
	ms := uint64(now.UTC().UnixMilli())
	for i := 5; i >= 0; i-- {
		b[i] = byte(ms)
		ms >>= 8
	}
	if _, err := rand.Read(b[6:]); err != nil {
		return "", fmt.Errorf("feedback id: %w", err)
	}
	return encodeCrockford(b[:]), nil
}

// encodeCrockford renders 16 bytes as 26 base32 characters, left-padding the
// bit stream with two zero bits.
func encodeCrockford(b []byte) string {
	out := make([]byte, idLen)
	for i := range out {
		var v byte
		for k := range 5 {
			pos := i*5 + k - 2
			v <<= 1
			if pos >= 0 && b[pos/8]&(0x80>>(pos%8)) != 0 {
				v |= 1
			}
		}
		out[i] = crockford[v]
	}
	return string(out)
}

// validID reports whether id is one of our ids. Screenshot paths are built from
// it: accept a stray "/" or ".." here and the handler serves arbitrary files.
func validID(id string) bool {
	if len(id) != idLen {
		return false
	}
	for i := range len(id) {
		if !isCrockford(id[i]) {
			return false
		}
	}
	return true
}

func isCrockford(c byte) bool {
	for i := range len(crockford) {
		if crockford[i] == c {
			return true
		}
	}
	return false
}
