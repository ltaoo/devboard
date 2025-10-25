//go:build windows

package system

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

func get_window_title() (string, error) {
	hwnd := windows.GetForegroundWindow()

	text := make([]uint16, 256)
	result, _, err := windows.NewLazySystemDLL("user32.dll").NewProc("GetWindowTextW").Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&text[0])),
		uintptr(len(text)),
	)

	if result == 0 {
		return "", err
	}

	return windows.UTF16ToString(text), nil
}
