//go:build windows

package biz

import (
	"golang.design/x/hotkey"
)

// const ModCommandKey = hotkey.ModWin
func NewHotkey() *hotkey.Hotkey {
	// fmt.Println("[]register hotkey")
	// hk := hotkey.New([]hotkey.Modifier{}, hotkey.)
	return &hotkey.Hotkey{}
}
