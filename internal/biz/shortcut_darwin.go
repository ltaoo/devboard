//go:build darwin && !ios

package biz

import "golang.design/x/hotkey"

var HotkeyModifierCodeMap = map[string]hotkey.Modifier{
	"ShiftLeft":    hotkey.ModShift,
	"ControlLeft":  hotkey.ModCtrl,
	"MetaLeft":     hotkey.ModCmd,
	"AltLeft":      hotkey.ModOption,
	"ShiftRight":   hotkey.ModShift,
	"ControlRight": hotkey.ModCtrl,
	"MetaRight":    hotkey.ModCmd,
	"AltRight":     hotkey.ModOption,
}
