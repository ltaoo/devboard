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

type FetchPasteEventListBody struct {
	models.Pagination

	Types   []string `json:"types"`
	Keyword string   `json:"keyword"`
}

func (s *PasteService) FetchPasteEventList(body FetchPasteEventListBody) *Result {
	if s.db == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	query := s.db.Preload("Content").Joins("JOIN paste_content ON paste_event.content_id = paste_content.id")
	if body.Keyword != "" {
		query = query.Where("paste_content.text LIKE ?", "%"+body.Keyword+"%")
	}
	if len(body.Types) != 0 {
		query = query.Where("paste_event.content_type in (?)", body.Types)
	}
	pb := models.NewPaginationBuilder[models.PasteEvent](query).
		SetLimit(body.PageSize).
		SetPage(body.Page).
		SetOrderBy("paste_event.created_at DESC")
	var list1 []models.PasteEvent
	if err := pb.Build().Find(&list1).Error; err != nil {
		return Error(err)
	}
	list2, has_more, next_marker := pb.ProcessResults(list1)
	return Ok(map[string]interface{}{
		"list":        list2,
		"page":        body.Page,
		"page_size":   pb.GetLimit(),
		"has_more":    has_more,
		"next_marker": next_marker,
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

type PasteEventBody struct {
	EventId int `json:"event_id"`
}

func (s *PasteService) DeletePasteEvent(body PasteEventBody) *Result {
	if body.EventId == 0 {
		return Error(fmt.Errorf("缺少 id 参数"))
	}
	var record models.PasteEvent
	if err := s.db.Where("id = ?", body.EventId).Delete(&record).Error; err != nil {
		return Error(err)
	}
	return Ok(&record)
}

type PasteEventPreviewBody struct {
	EventId int `json:"event_id"`
}

func (s *PasteService) PreviewPasteEvent(body PasteEventPreviewBody) *Result {
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
