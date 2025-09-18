package service

import (
	"fmt"
	"net/url"

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

func (s *PasteService) FetchPasteEventProfile() *Result {
	if s.db == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	var record models.PasteEvent
	if err := s.db.First(&record).Error; err != nil {
		return Error(err)
	}
	return Ok(&record)
}

type PastePreviewBody struct {
	EventId string `json:"event_id"`
}

func (s *PasteService) Preview(body PastePreviewBody) *Result {
	// type FilePreviewPayload struct {
	// 	Title string
	// 	URL   string
	// }
	// p := FilePreviewPayload{
	// 	Title: "",
	// 	URL:   "",
	// }
	// var record models.PasteEvent
	// if err := s.db.Preload("Content").First(&record).Error; err != nil {
	// 	return Error(err)
	// }
	// if lodash.Include([]string{"video/mp4"}, func(v string, i int) bool {
	// 	return v == record.ContentType
	// }) {
	// 	p.Title = "视频预览"
	// 	p.URL = "/preview"
	// } else if lodash.Include([]string{"image/jpeg", "image/png"}, func(v string, i int) bool {
	// 	return v == record.ContentType
	// }) {
	// 	p.Title = "图片预览"
	// 	p.URL = "/preview"
	// }
	// if p.URL == "" {
	// 	return Error(fmt.Errorf("该文件不支持预览"))
	// }
	s.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "预览",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Width:            420,
		Height:           720,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/preview?id=" + url.QueryEscape(body.EventId),
	})
	return Ok(map[string]interface{}{})
}
