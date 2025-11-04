//go:build windows

package system

import (
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

func get_process_id(hwnd uintptr) (uint32, error) {
	var pid uint32
	ret, _, err := getWindowThread.Call(
		hwnd,
		uintptr(unsafe.Pointer(&pid)),
	)
	if ret == 0 {
		return 0, err
	}
	return pid, nil
}

func get_foreground_process() (*ForegroundProcess, error) {
	h := get_foreground_window()
	pid, err := get_process_id(uintptr(h))
	if err != nil {
		return nil, err
	}
	const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
	hProcess, _, err := openProcess.Call(
		uintptr(PROCESS_QUERY_LIMITED_INFORMATION),
		uintptr(0),
		uintptr(pid),
	)
	if hProcess == 0 {
		return nil, err
	}
	defer closeHandle.Call(hProcess)

	buf := make([]uint16, syscall.MAX_PATH)
	size := uint32(len(buf))
	ret, _, err := queryProcessName.Call(
		hProcess,
		uintptr(0),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if ret == 0 {
		return nil, err
	}
	full_process_path := syscall.UTF16ToString(buf)
	process_name := filepath.Base(full_process_path)
	name_without_exe := strings.TrimSuffix(process_name, filepath.Ext(process_name))

	window_title, _ := get_window_title(h)

	return &ForegroundProcess{
		Name:            name_without_exe,
		ExecuteFullPath: full_process_path,
		WindowTitle:     window_title,
	}, nil
}

func active_process(id interface{}) error {
	return nil
}
