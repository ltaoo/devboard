//go:build windows

package biz

import (
	"fmt"

	"golang.design/x/hotkey"
)

// const ModCommandKey = hotkey.ModWin
func NewHotkey() *hotkey.Hotkey {
	fmt.Println("[]register hotkey")
	hk := hotkey.New([]hotkey.Modifier{hotkey.ModShift}, hotkey.KeyM)
	return hk
}
