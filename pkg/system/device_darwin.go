//go:build darwin && !ios

package system

import (
	"os"
	"os/exec"
	"strings"
)

func get_computer_name() (string, error) {
	cmd := exec.Command("scutil", "--get", "ComputerName")
	output, err := cmd.Output()
	if err == nil && len(output) > 0 {
		return strings.TrimSpace(string(output)), nil
	}
	cmd = exec.Command("defaults", "read", "/Library/Preferences/SystemConfiguration/preferences", "System", "System", "ComputerName")
	output, err = cmd.Output()
	if err == nil && len(output) > 0 {
		return strings.TrimSpace(string(output)), nil
	}
	hostname, err := os.Hostname()
	if err != nil {
		return "", err
	}
	return hostname, nil
}
