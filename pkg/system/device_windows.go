//go:build windows

package system

import (
	"golang.org/x/sys/windows"
)

func get_computer_name() (string, error) {
	var n uint32 = 128
	buf := make([]uint16, n)
	err := windows.GetComputerName(&buf[0], &n)
	if err != nil {
		return "", err
	}
	name := windows.UTF16ToString(buf[:n])
	return name, nil
}
