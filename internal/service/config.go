package service

import (
	"devboard/internal/biz"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type ConfigService struct {
	App *application.App
	Biz *biz.BizApp
}

func (s *ConfigService) Read() *Result {
	return Ok(s.Biz.UserConfig.Value)
}

func (s *ConfigService) WriteConfig(body map[string]interface{}) *Result {
	if err := s.Biz.UserConfig.WriteConfig(body); err != nil {
		return Error(err)
	}
	return Ok(s.Biz.UserConfig.Value)
}
