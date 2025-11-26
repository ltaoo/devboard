//go:build darwin
// +build darwin

package autostart

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Foundation -framework ServiceManagement
#include "autostart_darwin.h"
*/
import "C"
import "fmt"

type darwinAutoStart struct {
	appName string
}

func newPlatformAutoStart(appName string) AutoStart {
	return &darwinAutoStart{appName: appName}
}

func (a *darwinAutoStart) Enable() error {
	result := C.enableLoginItem()
	if result == 0 {
		return fmt.Errorf("failed to enable login item")
	}
	return nil
}

func (a *darwinAutoStart) Disable() error {
	result := C.disableLoginItem()
	if result == 0 {
		return fmt.Errorf("failed to disable login item")
	}
	return nil
}

func (a *darwinAutoStart) IsEnabled() bool {
	result := C.isLoginItemEnabled()
	return result == 1
}
