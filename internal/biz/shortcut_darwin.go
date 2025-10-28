//go:build darwin && !ios

package biz

import (
	"golang.design/x/hotkey"
)

// const ModCommandKey = hotkey.ModCmd
func NewHotkey() *hotkey.Hotkey {
	// fmt.Println("[]register hotkey in darwin")
	// hk := hotkey.New([]hotkey.Modifier{hotkey.ModCmd, hotkey.ModShift}, hotkey.KeyM)
	hk := hotkey.New([]hotkey.Modifier{hotkey.ModCmd}, hotkey.Key(0x32))
	return hk
}
