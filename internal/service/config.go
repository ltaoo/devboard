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
	return Ok(s.Biz.Perferences.Value)
}

func (s *ConfigService) WriteConfig(body map[string]interface{}) *Result {
	if err := s.Biz.Perferences.WriteConfig(body); err != nil {
		return Error(err)
	}
	return Ok(s.Biz.Perferences.Value)
}

type SettingsUpdateBody struct {
	Path  string
	Value interface{}
}

func (s *ConfigService) UpdateSettingsByPath(body SettingsUpdateBody) *Result {
	if err := s.Biz.Perferences.WriteValueWithPath(body.Path, body.Value); err != nil {
		return Error(err)
	}
	return Ok(nil)
}
