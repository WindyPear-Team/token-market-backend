package service

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"testing"
)

func TestPublicKeyFromCOSEES256(t *testing.T) {
	x, y := elliptic.P256().ScalarBaseMult([]byte{1})
	cose := []byte{0xA5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20}
	cose = append(cose, fixedP256Coordinate(x.Bytes())...)
	cose = append(cose, 0x22, 0x58, 0x20)
	cose = append(cose, fixedP256Coordinate(y.Bytes())...)

	key, err := publicKeyFromCOSE(cose)
	if err != nil {
		t.Fatalf("publicKeyFromCOSE returned error: %v", err)
	}
	publicKey, ok := key.(*ecdsa.PublicKey)
	if !ok {
		t.Fatalf("publicKeyFromCOSE returned %T, want *ecdsa.PublicKey", key)
	}
	if !publicKey.Curve.IsOnCurve(publicKey.X, publicKey.Y) {
		t.Fatal("public key is not on P-256")
	}
}

func fixedP256Coordinate(value []byte) []byte {
	result := make([]byte, 32)
	copy(result[32-len(value):], value)
	return result
}
