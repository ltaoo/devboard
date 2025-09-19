package service

import (
	"fmt"
	"net/url"
	"strconv"

	"github.com/wailsapp/wails/v3/pkg/application"

	"gorm.io/gorm"

	"devboard/models"
)

type PasteService struct {
	app *application.App
	db  *gorm.DB
}

func NewPasteService(app *application.App, db *gorm.DB) PasteService {
	return PasteService{
		app: app,
		db:  db,
	}
}
func (s *PasteService) SetDatabase(db *gorm.DB) {
	s.db = db
}
func (s *PasteService) FetchPasteEventList() *Result {
	var list []models.PasteEvent
	if s.db == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}

	if err := s.db.Preload("Content").Order("created_at DESC").Find(&list).Error; err != nil {
		return Error(err)
	}
	return Ok(map[string]interface{}{
		"list": list,
	})
}

type PasteEventProfileBody struct {
	EventId int `json:"event_id"`
}

func (s *PasteService) FetchPasteEventProfile(body PasteEventProfileBody) *Result {
	if s.db == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	if body.EventId == 0 {
		return Error(fmt.Errorf("缺少 id 参数"))
	}
	var record models.PasteEvent
	if err := s.db.Where("id = ?", body.EventId).Preload("Content").First(&record).Error; err != nil {
		return Error(err)
	}
	return Ok(&record)
}

type PastePreviewBody struct {
	EventId int `json:"event_id"`
}

func (s *PasteService) Preview(body PastePreviewBody) *Result {
	if body.EventId == 0 {
		return Error(fmt.Errorf("缺少 event_id 参数"))
	}
	s.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "预览",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			// TitleBar:                application.MacTitleBarHiddenInset,
		},
		Width:            980,
		Height:           680,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/preview?id=" + url.QueryEscape(strconv.Itoa(body.EventId)),
	})
	return Ok(map[string]interface{}{})
}
