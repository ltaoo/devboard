//go:build !darwin
// +build !darwin

package ocr

import "fmt"

func RecognizeBytes(img []byte, lang string) (string, error) {
	return "", fmt.Errorf("ocr not supported on this platform")
}

