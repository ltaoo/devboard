//go:build darwin && !ios

package system

import (
	"fmt"
	"path/filepath"
	"strings"
	"unsafe"

	"github.com/ebitengine/purego/objc"
)

const (
	NSApplicationActivateAllWindows        = 1 << 0
	NSApplicationActivateIgnoringOtherApps = 1 << 1
)

func get_foreground_process() (*ForegroundProcess, error) {
	v, err := get_foreground_window()
	if err != nil {
		return nil, err
	}
	__app, ok := v.(objc.ID)
	if !ok {
		return nil, fmt.Errorf("get foreground app fail")
	}
	window_title, err := get_window_title(__app)
	if err != nil {
		return nil, err
	}
	// __url := __app.Send(_bundleURL)
	__url := __app.Send(_executableURL)
	if __url == 0 {
		return nil, fmt.Errorf("无法获取可执行文件路径")
	}
	__path := __url.Send(_path)
	if __path == 0 {
		return nil, fmt.Errorf("无法转换路径")
	}
	utf8_ptr := unsafe.Pointer(__path.Send(_UTF8String))
	full_process_path := pointer_to_utf8_string(utf8_ptr)
	process_name := filepath.Base(full_process_path)
	name_without_exe := strings.TrimSuffix(process_name, filepath.Ext(process_name))
	return &ForegroundProcess{
		Name:            name_without_exe,
		ExecuteFullPath: full_process_path,
		WindowTitle:     window_title,
		Reference:       __app,
	}, nil
}

func active_process(v interface{}) error {
	__app, ok := v.(objc.ID)
	if !ok {
		return fmt.Errorf("get foreground app fail")
	}
	options := NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps
	__r := __app.Send(_activateWithOptions, options)
	if __r == 0 {
		return fmt.Errorf("唤起失败")
	}
	return nil
}
