package service

import (
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/internal/biz"
	"devboard/internal/controller"
	"devboard/models"
	"devboard/pkg/lodash"
)

type CommonService struct {
	App *application.App
	Biz *biz.BizApp
}

func NewCommonService(app *application.App, biz *biz.BizApp) *CommonService {
	return &CommonService{App: app, Biz: biz}
}

func (s *CommonService) OpenWindow(body biz.OpenWindowBody) *Result {
	_, err := s.Biz.OpenWindow(body)
	if err != nil {
		return Error(err)
	}
	return Ok(map[string]interface{}{
		"ok": true,
	})
}

func (s *CommonService) ShowError(body biz.ErrorBody) *Result {
	s.Biz.ShowError(body)
	return Ok(map[string]interface{}{})
}

type ShortcutRegisterBody struct {
	Shortcut string `json:"shortcut"`
	Command  string `json:"command"`
}

func (s *CommonService) RegisterShortcut(body ShortcutRegisterBody) *Result {
	if body.Shortcut == "" {
		return Error(fmt.Errorf("Missing the shortcut"))
	}
	if err := s.Biz.RegisterShortcutWithCommand(body.Shortcut, body.Command); err != nil {
		return Error(err)
	}
	return Ok(nil)
}

func (s *CommonService) UnregisterShortcut(body ShortcutRegisterBody) *Result {
	if body.Shortcut == "" {
		return Error(fmt.Errorf("Missing the shortcut"))
	}
	if err := s.Biz.UnregisterShortcut(body.Shortcut); err != nil {
		return Error(err)
	}
	return Ok(nil)
}

func (s *CommonService) FetchAppList(body controller.AppListBody) *Result {
	list, err := s.Biz.ControllerMap.App.FetchAppList(body)
	if err != nil {
		return Error(err)
	}
	result := lodash.Map(list, func(v *models.App, idx int) map[string]interface{} {
		return map[string]interface{}{
			"id":       v.Id,
			"name":     v.Name,
			"logo_url": v.LogoURL,
		}
	})
	return Ok(controller.ListResp[map[string]interface{}]{
		List:       result,
		Page:       1,
		PageSize:   100,
		HasMore:    false,
		NextMarker: "",
	})
}

func (s *CommonService) FetchDeviceList(body controller.DeviceListBody) *Result {
	list, err := s.Biz.ControllerMap.Device.FetchDeviceList(body)
	if err != nil {
		return Error(err)
	}
	result := lodash.Map(list, func(v *models.Device, idx int) map[string]interface{} {
		return map[string]interface{}{
			"id":   v.Id,
			"name": v.Name,
		}
	})
	return Ok(controller.ListResp[map[string]interface{}]{
		List:       result,
		Page:       1,
		PageSize:   100,
		HasMore:    false,
		NextMarker: "",
	})
}
