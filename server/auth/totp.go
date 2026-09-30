package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/boombuler/barcode"
	"github.com/boombuler/barcode/qr"
	"github.com/pquerna/otp/totp"
)

type TwoFactorSetup struct {
	Secret        string   `json:"secret"`
	QRCodeSVG     string   `json:"qr_code_svg"`
	RecoveryCodes []string `json:"recovery_codes"`
}

func GenerateTwoFactorSetup(email string) (*TwoFactorSetup, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Tako",
		AccountName: email,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate totp key: %w", err)
	}

	qrCode, err := qr.Encode(key.URL(), qr.M, qr.Auto)
	if err != nil {
		return nil, fmt.Errorf("failed to encode qr code: %w", err)
	}
	scaledQr, err := barcode.Scale(qrCode, 200, 200)
	if err != nil {
		return nil, fmt.Errorf("failed to scale qr code: %w", err)
	}

	// Build SVG payload
	bounds := scaledQr.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	var svgBuilder strings.Builder
	svgBuilder.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges">`, width, height))
	svgBuilder.WriteString(fmt.Sprintf(`<rect width="%d" height="%d" fill="#ffffff"/>`, width, height))

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, _ := scaledQr.At(x, y).RGBA()
			if r == 0 && g == 0 && b == 0 {
				svgBuilder.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="1" height="1" fill="#000000"/>`, x, y))
			}
		}
	}
	svgBuilder.WriteString(`</svg>`)

	recoveryCodes := make([]string, 8)
	for i := 0; i < 8; i++ {
		bytes := make([]byte, 4)
		if _, err := rand.Read(bytes); err != nil {
			return nil, fmt.Errorf("failed to generate recovery code: %w", err)
		}
		hexStr := hex.EncodeToString(bytes)
		recoveryCodes[i] = fmt.Sprintf("%s-%s", hexStr[:4], hexStr[4:])
	}

	return &TwoFactorSetup{
		Secret:        key.Secret(),
		QRCodeSVG:     svgBuilder.String(),
		RecoveryCodes: recoveryCodes,
	}, nil
}

func ValidateTwoFactorCode(code string, secret string) bool {
	return totp.Validate(strings.TrimSpace(code), secret)
}
