package service

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/internal/transformer"
	"devboard/models"
	"devboard/pkg/clipboard"
)

type PasteService struct {
	App *application.App
	Biz *biz.BizApp
}

func NewPasteService(app *application.App, biz *biz.BizApp) *PasteService {
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
		SetOrderBy("datetime(paste_event.created_at) DESC")
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
	Focus   bool   `json:"focus"`
}

func (s *PasteService) PreviewPasteEvent(body PasteEventPreviewBody) *Result {
	if body.EventId == "" {
		return Error(fmt.Errorf("缺少 event_id 参数"))
	}
	unique_url := "/preview"
	url := unique_url + "?id=" + url.QueryEscape(body.EventId)
	existing_win := s.Biz.FindWindow(unique_url)
	if existing_win != nil {
		existing_win.SetURL(url)
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
	s.Biz.AppendWindow(unique_url, win)
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
	if record.ContentType == "html" {
		s.Biz.ManuallyWriteClipboardTime = time.Now()
		text := record.Html
		if text == "" {
			text = record.Text
		}
		if err := clipboard.WriteText(text); err != nil {
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

func (s *PasteService) HandlePasteFile(files []string) (*models.PasteEvent, error) {
	var created_paste_event models.PasteEvent
	now := time.Now()
	var results []FileInPasteBoard
	for _, f := range files {
		info, err := os.Stat(f)
		if err != nil {
			continue
		}
		name := info.Name()
		if info.IsDir() {
			results = append(results, FileInPasteBoard{
				Name:         name,
				AbsolutePath: f,
				MimeType:     "folder",
			})
			continue
		}
		mime_type := mime.TypeByExtension(filepath.Ext(name))
		if mime_type == "" {
			// 如果无法通过扩展名确定，使用 application/octet-stream 作为默认值
			mime_type = "application/octet-stream"
		} else {
			// 去除可能的参数（如 charset=utf-8）
			mime_type = strings.Split(mime_type, ";")[0]
		}
		results = append(results, FileInPasteBoard{
			Name:         name,
			AbsolutePath: f,
			MimeType:     mime_type,
		})
	}
	if len(results) != 0 {
		content, err := json.Marshal(&results)
		if err != nil {
			return nil, err
		}
		created_paste_event = models.PasteEvent{
			Id:                uuid.New().String(),
			ContentType:       "file",
			FileListJSON:      string(content),
			LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
			LastOperationType: 1,
		}
		// created_paste_event.Content = created_paste_content
		if err := s.Biz.DB.Create(&created_paste_event).Error; err != nil {
			log.Fatalf("Failed to create paste event: %v", err)
			return nil, err
		}
		categories := []string{"file"}
		for _, c := range categories {
			created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
				Id:    c,
				Label: c,
			})
			created_map := models.PasteEventCategoryMapping{
				Id:                uuid.New().String(),
				PasteEventId:      created_paste_event.Id,
				CategoryId:        c,
				LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
				LastOperationType: 1,
				CreatedAt:         now,
			}
			if err := s.Biz.DB.Create(&created_map).Error; err != nil {
			}
		}
	}
	return &created_paste_event, nil
}

func (s *PasteService) HandlePasteText(text string) (*models.PasteEvent, error) {
	var created_paste_event models.PasteEvent
	now := time.Now()
	// if prev_paste_event.Id != 0 {
	// 	prev_type := prev_paste_event.ContentType
	// 	prev_text := prev_paste_event.Content.Text
	// 	if prev_type == "text" && prev_text == text {
	// 		return
	// 	}
	// }
	created_paste_event = models.PasteEvent{
		Id:                uuid.New().String(),
		ContentType:       "text",
		Text:              text,
		LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
		LastOperationType: 1,
	}
	if err := s.Biz.DB.Create(&created_paste_event).Error; err != nil {
		log.Fatalf("Failed to create paste event: %v", err)
		return nil, err
	}
	categories := transformer.TextContentDetector(text)
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			Id:    c,
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			Id:                uuid.New().String(),
			PasteEventId:      created_paste_event.Id,
			CategoryId:        c,
			LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
			LastOperationType: 1,
			CreatedAt:         now,
		}
		if err := s.Biz.DB.Create(&created_map).Error; err == nil {
		}
	}
	return &created_paste_event, nil
}

func (s *PasteService) HandlePasteHTML(text string) (*models.PasteEvent, error) {
	var created_paste_event models.PasteEvent
	now := time.Now()
	created_paste_event = models.PasteEvent{
		Id:                uuid.New().String(),
		ContentType:       "html",
		Html:              text,
		LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
		LastOperationType: 1,
	}
	if err := s.Biz.DB.Create(&created_paste_event).Error; err != nil {
		log.Fatalf("Failed to create paste event: %v", err)
		return nil, err
	}
	categories := []string{"html"}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			Id:    c,
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			Id:                uuid.New().String(),
			PasteEventId:      created_paste_event.Id,
			CategoryId:        c,
			LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
			LastOperationType: 1,
			CreatedAt:         now,
		}
		if err := s.Biz.DB.Create(&created_map).Error; err == nil {
		}
	}
	return &created_paste_event, nil
}

func (s *PasteService) HandlePastePNG(f []byte) (*models.PasteEvent, error) {
	var created_paste_event models.PasteEvent
	now := time.Now()
	encoded := base64.StdEncoding.EncodeToString(f)
	// if prev_paste_event.Id != 0 {
	// 	prev_type := prev_paste_event.ContentType
	// 	prev_image_base64 := prev_paste_event.Content.ImageBase64
	// 	if prev_type == "image" && prev_image_base64 == encoded {
	// 		return
	// 	}
	// }
	created_paste_event = models.PasteEvent{
		Id:                uuid.New().String(),
		ContentType:       "image",
		ImageBase64:       encoded,
		LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
		LastOperationType: 1,
	}
	// created_paste_event.Content = created_paste_content
	if err := s.Biz.DB.Create(&created_paste_event).Error; err != nil {
		log.Fatalf("Failed to create paste event: %v", err)
		return nil, err
	}
	categories := []string{"image"}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			Id:    c,
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			Id:                uuid.New().String(),
			PasteEventId:      created_paste_event.Id,
			CategoryId:        c,
			LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
			LastOperationType: 1,
			CreatedAt:         now,
		}
		if err := s.Biz.DB.Create(&created_map).Error; err != nil {
		}
	}
	return &created_paste_event, nil
}

type MockPasteTextBody struct {
	Text string `json:"text"`
}

func (s *PasteService) MockPasteText(body MockPasteTextBody) *Result {
	if body.Text == "" {
		return Error(fmt.Errorf("Missing the text."))
	}
	now := time.Now()
	created_paste_event := models.PasteEvent{
		Id:                uuid.New().String(),
		ContentType:       "text",
		Text:              body.Text,
		LastOperationTime: strconv.FormatInt(now.UnixMilli(), 10),
		LastOperationType: 1,
		Categories:        []models.CategoryNode{},
		CreatedAt:         now,
	}
	s.App.Event.Emit("clipboard:update", created_paste_event)
	return Ok(created_paste_event)
}
