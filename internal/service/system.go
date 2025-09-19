package service

import (
	"os"
	"runtime"
)

type SystemService struct {
}

func (s *SystemService) FetchComputeInfo() *Result {
	// 获取主机名
	hostname, _ := os.Hostname()

	return Ok(map[string]interface{}{
		"hostname": hostname,
		"os":       runtime.GOOS,
		"arch":     runtime.GOARCH,
	})
}
