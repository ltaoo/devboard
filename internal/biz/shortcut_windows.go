//go:build windows

package biz

import (
	"golang.design/x/hotkey"
)

// const ModCommandKey = hotkey.ModWin
func new_hotkey() *hotkey.Hotkey {
	// fmt.Println("[]register hotkey")
	// hk := hotkey.New([]hotkey.Modifier{}, hotkey.)
	hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl}, hotkey.Key(0xC0))
	return hk
}
