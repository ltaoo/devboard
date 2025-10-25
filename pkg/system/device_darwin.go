package system

import (
	"os"
	"os/exec"
	"strings"
)

func get_computer_name() string {
	// 方法1: 使用 scutil 获取 ComputerName（最准确）
	cmd := exec.Command("scutil", "--get", "ComputerName")
	output, err := cmd.Output()
	if err == nil && len(output) > 0 {
		return strings.TrimSpace(string(output))
	}

	// 方法2: 备用方案 - 使用系统配置
	cmd = exec.Command("defaults", "read", "/Library/Preferences/SystemConfiguration/preferences", "System", "System", "ComputerName")
	output, err = cmd.Output()
	if err == nil && len(output) > 0 {
		return strings.TrimSpace(string(output))
	}

	// 方法3: 最后回退到 hostname
	hostname, _ := os.Hostname()
	return hostname
}
