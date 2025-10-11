package service

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/models"
	"devboard/pkg/clipboard"
)

type PasteService struct {
	App *application.App
	Biz *biz.App
}

func NewPasteService(app *application.App, biz *biz.App) *PasteService {
	return &PasteService{
		App: app,
		Biz: biz,
	}
}

type FetchPasteEventListBody struct {
	models.Pagination

	Types   []string `json:"types"`
	Keyword string   `json:"keyword"`
}

func (s *PasteService) FetchPasteEventList(body FetchPasteEventListBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	query := s.Biz.DB.Model(&models.PasteEvent{})
	if body.Keyword != "" {
		query = query.Where("paste_event.text LIKE ?", "%"+body.Keyword+"%")
	}
	if len(body.Types) != 0 {
		query = query.Joins("JOIN paste_event_category_mapping ON paste_event_category_mapping.paste_event_id = paste_event.id").Where("paste_event_category_mapping.category_id IN ?", body.Types).Distinct("paste_event.*")
	}
	pb := models.NewPaginationBuilder[models.PasteEvent](query).
		SetLimit(body.PageSize).
		SetPage(body.Page).
		SetOrderBy("paste_event.created_at DESC")
	var list1 []models.PasteEvent
	if err := pb.Build().Preload("Categories").Find(&list1).Error; err != nil {
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
	EventId string `json:"event_id"`
}

func (s *PasteService) FetchPasteEventProfile(body PasteEventProfileBody) *Result {
	if s.Biz.DB == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	if body.EventId == "" {
		return Error(fmt.Errorf("缺少 id 参数"))
	}
	var record models.PasteEvent
	if err := s.Biz.DB.Where("id = ?", body.EventId).Preload("Categories").First(&record).Error; err != nil {
		return Error(err)
	}
	return Ok(&record)
}

type PasteEventBody struct {
	EventId string `json:"event_id"`
}

func (s *PasteService) DeletePasteEvent(body PasteEventBody) *Result {
	if body.EventId == "" {
		return Error(fmt.Errorf("缺少 id 参数"))
	}
	var record models.PasteEvent
	err := s.Biz.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", body.EventId).First(&record).Error; err != nil {
			return err
		}
		record.LastOperationTime = strconv.FormatInt(time.Now().UnixMilli(), 10)
		record.LastOperationType = 3
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		return tx.Delete(&record).Error
	})
	if err != nil {
		return Error(err)
	}
	return Ok(&record)
}

type PasteEventPreviewBody struct {
	EventId string `json:"event_id"`
}

func (s *PasteService) PreviewPasteEvent(body PasteEventPreviewBody) *Result {
	if body.EventId == "" {
		return Error(fmt.Errorf("缺少 event_id 参数"))
	}
	url := "/preview?id=" + url.QueryEscape(body.EventId)
	existing_win := s.Biz.FindWindow(url)
	if existing_win != nil {
		return Ok(map[string]interface{}{
			"ok": true,
		})
	}
	win := s.App.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "预览",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			// TitleBar:                application.MacTitleBarHiddenInset,
		},
		Width:            980,
		Height:           680,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              url,
	})
	s.Biz.AppendWindow(url, win)
	return Ok(map[string]interface{}{})
}

type PasteboardWriteBody struct {
	EventId string `json:"event_id"`
	// ContentType string `json:"content_type"`
	// Text        string `json:"text"`
}

type FileInPasteBoard struct {
	Name         string `json:"name"`
	AbsolutePath string `json:"absolute_path"`
	MimeType     string `json:"mime_type"`
}

func (s *PasteService) Write(body PasteboardWriteBody) *Result {
	if s.Biz.DB == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	if body.EventId == "" {
		return Error(fmt.Errorf("缺少 id 参数"))
	}
	var record models.PasteEvent
	if err := s.Biz.DB.Where("id = ?", body.EventId).First(&record).Error; err != nil {
		return Error(err)
	}
	if record.ContentType == "text" {
		s.Biz.ManuallyWriteClipboardTime = time.Now()
		if err := clipboard.WriteText(record.Text); err != nil {
			return Error(err)
		}
	}
	if record.ContentType == "image" {
		s.Biz.ManuallyWriteClipboardTime = time.Now()
		decoded_data, err := base64.StdEncoding.DecodeString(record.ImageBase64)
		if err != nil {
			return Error(err)
		}
		if err := clipboard.WriteImage(decoded_data); err != nil {
			return Error(err)
		}
	}
	if record.ContentType == "file" {
		s.Biz.ManuallyWriteClipboardTime = time.Now()
		var files []FileInPasteBoard
		if err := json.Unmarshal([]byte(record.FileListJSON), &files); err != nil {
			return Error(err)
		}
		var errors []string
		var file_paths []string
		for _, f := range files {
			_, err := os.Stat(f.AbsolutePath)
			if err != nil {
				errors = append(errors, err.Error())
				continue
			}
			file_paths = append(file_paths, f.AbsolutePath)
		}
		if len(file_paths) == 0 {
			return Error(fmt.Errorf("There's no valid file can copy."))
		}
		if err := clipboard.WriteFiles(file_paths); err != nil {
			return Error(err)
		}
	}
	return Ok(nil)
}
