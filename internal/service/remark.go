package service

import (
	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/internal/biz"
	"devboard/internal/controller"
)

type RemarkService struct {
	App *application.App
	Biz *biz.BizApp
}

func NewRemarkService(app *application.App, biz *biz.BizApp) *RemarkService {
	return &RemarkService{
		App: app,
		Biz: biz,
	}
}

func (s *RemarkService) CreateRemark(body controller.RemarkCreateBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	created, err := s.Biz.ControllerMap.Remark.CreateRemark(body)
	if err != nil {
		return Error(err)
	}
	return Ok(created)
}

func (s *RemarkService) FetchRemarkList(body controller.RemarkListBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	list, err := s.Biz.ControllerMap.Remark.FetchRemarkList(body)
	if err != nil {
		return Error(err)
	}
	return Ok(list)
}

func (s *RemarkService) DeleteRemark(body controller.RemarkDeleteBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	_, err := s.Biz.ControllerMap.Remark.DeleteRemark(body)
	if err != nil {
		return Error(err)
	}
	return Ok(nil)
}
