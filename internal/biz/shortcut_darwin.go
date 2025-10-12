//go:build darwin && !ios

package biz

import (
	"fmt"

	"golang.design/x/hotkey"
)

// const ModCommandKey = hotkey.ModCmd
func NewHotkey() *hotkey.Hotkey {
	fmt.Println("[]register hotkey in darwin")
	hk := hotkey.New([]hotkey.Modifier{hotkey.ModCmd, hotkey.ModShift}, hotkey.KeyM)
	return hk
}
