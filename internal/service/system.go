package service

import (
	"github.com/shirou/gopsutil/host"

	"devboard/internal/biz"
	"devboard/pkg/system"
)

type SystemService struct {
	Biz *biz.BizApp
}
type SystemInfoField struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Text  string `json:"text"`
}

func (s *SystemService) FetchComputeInfo() *Result {
	info, err := host.Info()
	if err != nil {
		return Error(err)
	}

	device := [...]SystemInfoField{
		{
			Key:   "host_id",
			Label: "主机 id",
			Text:  info.HostID,
		},
		{
			Key:   "hostname",
			Label: "主机名",
			Text:  system.GetComputerName(),
		},
		{
			Key:   "os",
			Label: "操作系统",
			Text:  info.OS,
		},
		{
			Key:   "platform",
			Label: "平台",
			Text:  info.Platform,
		},
		{
			Key:   "platform_version",
			Label: "平台版本",
			Text:  info.PlatformVersion,
		},
		{
			Key:   "kernel_version",
			Label: "内核版本",
			Text:  info.KernelVersion,
		},
	}
	app := [...]SystemInfoField{
		{
			Key:   "app_version",
			Label: "版本号",
			Text:  s.Biz.Config.ProductVersion,
		},
	}

	return Ok(map[string]interface{}{
		"device": device,
		"app":    app,
	})
}
