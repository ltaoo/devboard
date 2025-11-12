package biz

import (
	"fmt"
	"strings"

	"golang.design/x/hotkey"
)

var HotkeyCodeMap = map[string]hotkey.Key{
	"Escape":       hotkey.KeyEscape,
	"Backquote":    hotkey.Key(0x32), // ~
	"Digit1":       hotkey.Key1,
	"Digit2":       hotkey.Key2,
	"Digit3":       hotkey.Key3,
	"Digit4":       hotkey.Key4,
	"Digit5":       hotkey.Key5,
	"Digit6":       hotkey.Key6,
	"Digit7":       hotkey.Key7,
	"Digit8":       hotkey.Key8,
	"Digit9":       hotkey.Key9,
	"Digit0":       hotkey.Key0,
	"Minus":        hotkey.Key(0),
	"Equal":        hotkey.Key(0),
	"Backspace":    hotkey.KeyReturn,
	"KeyQ":         hotkey.KeyQ,
	"KeyW":         hotkey.KeyW,
	"KeyE":         hotkey.KeyE,
	"KeyR":         hotkey.KeyR,
	"KeyT":         hotkey.KeyT,
	"KeyY":         hotkey.KeyY,
	"KeyU":         hotkey.KeyU,
	"KeyI":         hotkey.KeyI,
	"KeyO":         hotkey.KeyO,
	"KeyP":         hotkey.KeyP,
	"KeyA":         hotkey.KeyA,
	"KeyS":         hotkey.KeyS,
	"KeyD":         hotkey.KeyD,
	"KeyF":         hotkey.KeyF,
	"KeyG":         hotkey.KeyG,
	"KeyH":         hotkey.KeyH,
	"KeyJ":         hotkey.KeyJ,
	"KeyK":         hotkey.KeyK,
	"KeyL":         hotkey.KeyL,
	"KeyZ":         hotkey.KeyZ,
	"KeyX":         hotkey.KeyX,
	"KeyC":         hotkey.KeyC,
	"KeyV":         hotkey.KeyV,
	"KeyB":         hotkey.KeyB,
	"KeyN":         hotkey.KeyN,
	"KeyM":         hotkey.KeyM,
	"Space":        hotkey.KeySpace,
	"Comma":        hotkey.Key(0),
	"Period":       hotkey.Key(0),
	"Slash":        hotkey.Key(0),
	"BackSlash":    hotkey.Key(0),
	"Enter":        hotkey.Key(0),
	"BracketRight": hotkey.Key(0),
	"BracketLeft":  hotkey.Key(0),
	"Semicolon":    hotkey.Key(0),
	"Quote":        hotkey.Key(0),
	"Tab":          hotkey.KeyTab,
	"ArrowUp":      hotkey.KeyUp,
	"ArrowDown":    hotkey.KeyDown,
	"ArrowLeft":    hotkey.KeyLeft,
	"ArrowRight":   hotkey.KeyRight,
}

func MapFrontendShortcutTo(codes string) {
	// keys := strings.Split(codes, "+")
}

func NewHotkey(vvv string) (*hotkey.Hotkey, error) {
	keys := strings.Split(vvv, "+")
	if len(keys) == 0 {
		return nil, fmt.Errorf("the shortcut is empty")
	}
	var modifiers []hotkey.Modifier
	var key hotkey.Key
	for _, code := range keys {
		modifier, ok := HotkeyModifierCodeMap[code]
		if ok {
			modifiers = append(modifiers, modifier)
			continue
		}
		k, ok := HotkeyCodeMap[code]
		if ok {
			key = k
			continue
		}
	}
	if len(modifiers) == 0 {
		return nil, fmt.Errorf("there's must have a modifier")
	}
	if key == 0 {
		return nil, fmt.Errorf("there's must have a key")
	}
	hk := hotkey.New(modifiers, key)
	return hk, nil
}
