package service

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/internal/controller"
)

type RemarkService struct {
	App *application.App
	Biz *biz.BizApp
	Con *controller.PasteEventRemarkController
}

func NewRemarkService(app *application.App, biz *biz.BizApp) *RemarkService {
	return &RemarkService{
		App: app,
		Biz: biz,
		Con: controller.NewRemarkController(biz.DB),
	}
}

func (s *RemarkService) WithDB(db *gorm.DB) {
	s.Con = controller.NewRemarkController(db)
}

func (s *RemarkService) CreateRemark(body controller.RemarkCreateBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	created, err := s.Con.CreateRemark(body)
	if err != nil {
		return Error(err)
	}
	return Ok(created)
}

func (s *RemarkService) FetchRemarkList(body controller.RemarkListBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	list, err := s.Con.FetchRemarkList(body)
	if err != nil {
		return Error(err)
	}
	return Ok(list)
}

func (s *RemarkService) DeleteRemark(body controller.RemarkDeleteBody) *Result {
	_, err := s.Con.DeleteRemark(body)
	if err != nil {
		return Error(err)
	}
	return Ok(nil)
}
