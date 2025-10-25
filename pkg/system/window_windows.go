//go:build windows

package system

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32           = windows.NewLazySystemDLL("user32.dll")
	kernel32         = windows.NewLazySystemDLL("kernel32.dll")
	getWindowText    = user32.NewProc("GetWindowTextW")
	getWindowThread  = user32.NewProc("GetWindowThreadProcessId")
	openProcess      = kernel32.NewProc("OpenProcess")
	closeHandle      = kernel32.NewProc("CloseHandle")
	queryProcessName = kernel32.NewProc("QueryFullProcessImageNameW")
)

func get_foreground_window() windows.HWND {
	hwnd := windows.GetForegroundWindow()
	return hwnd
}
func get_window_title(v interface{}) (string, error) {
	// hwnd := get_foreground_window()
	hwnd, ok := v.(windows.HWND)
	if !ok {
		return "", fmt.Errorf("not a valid hwnd")
	}
	text := make([]uint16, 256)
	result, _, err := getWindowText.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&text[0])),
		uintptr(len(text)),
	)

	if result == 0 {
		return "", err
	}

	return windows.UTF16ToString(text), nil
}
