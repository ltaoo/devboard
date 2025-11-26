//go:build !darwin && !windows
// +build !darwin,!windows

package autostart

import "fmt"

type stubAutoStart struct {
	appName string
}

func newPlatformAutoStart(appName string) AutoStart {
	return &stubAutoStart{appName: appName}
}

func (a *stubAutoStart) Enable() error {
	return fmt.Errorf("autostart not supported on this platform")
}

func (a *stubAutoStart) Disable() error {
	return fmt.Errorf("autostart not supported on this platform")
}

func (a *stubAutoStart) IsEnabled() bool {
	return false
}
