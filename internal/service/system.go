package service

import (
	"devboard/internal/biz"
	"os"
	"runtime"
)

type SystemService struct {
	Biz *biz.App
}

func (s *SystemService) FetchComputeInfo() *Result {
	hostname, _ := os.Hostname()

	return Ok(map[string]interface{}{
		"hostname": hostname,
		"os":       runtime.GOOS,
		"arch":     runtime.GOARCH,
	})
}
