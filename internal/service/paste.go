package service

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/ltaoo/clipboard-go"
	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/internal/transformer"
	"devboard/models"
	"devboard/pkg/html"
	"devboard/pkg/util"
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
	if err := s.Biz.DB.Where("id = ?", body.EventId).Preload("App").Preload("Device").Preload("Remarks").Preload("Categories").First(&record).Error; err != nil {
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
	var existing models.PasteEvent
	if err := s.Biz.DB.Where("id = ?", body.EventId).First(&existing).Error; err != nil {
		return Error(err)
	}
	existing.DeletedAt = gorm.DeletedAt{Time: time.Now(), Valid: true}
	if err := s.Biz.DB.Save(&existing).Error; err != nil {
		return Error(err)
	}
	return Ok(nil)
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
	is_text := record.ContentType == "text"
	is_html := record.ContentType == "html"
	is_image := record.ContentType == "image"
	is_file := record.ContentType == "file"

	if record.Html != "" {
		is_html = true
	}
	if record.ImageBase64 != "" {
		is_image = true
	}
	if record.FileListJSON != "" {
		is_file = true
	}

	if is_html {
		s.Biz.ManuallyWriteClipboardTime = time.Now()
		text := record.Html
		if text == "" {
			text = record.Text
		}
		if err := clipboard.WriteHTML(text); err != nil {
			return Error(err)
		}
		return Ok(nil)
	}
	if is_text {
		s.Biz.ManuallyWriteClipboardTime = time.Now()
		if err := clipboard.WriteText(record.Text); err != nil {
			return Error(err)
		}
		return Ok(nil)
	}
	if is_image {
		s.Biz.ManuallyWriteClipboardTime = time.Now()
		decoded_data, err := base64.StdEncoding.DecodeString(record.ImageBase64)
		if err != nil {
			return Error(err)
		}
		if err := clipboard.WriteImage(decoded_data); err != nil {
			return Error(err)
		}
		return Ok(nil)
	}
	if is_file {
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
		return Ok(nil)
	}
	return Error(fmt.Errorf("invalid record data"))
}

type ContentDownloadBody struct {
	PasteEventId string `json:"paste_event_id"`
}

func (f *PasteService) DownloadContentWithPasteEventId(body ContentDownloadBody) *Result {
	if body.PasteEventId == "" {
		return Error(fmt.Errorf("缺少 event id 参数"))
	}

	var existing []models.PasteEvent
	if err := f.Biz.DB.Where("id = ?", body.PasteEventId).Limit(1).Find(&existing).Error; err != nil {
		return Error(err)
	}
	if len(existing) == 0 {
		return Error(fmt.Errorf("can't find the record with given paste event id."))
	}
	existing_paste_event := existing[0]
	if existing_paste_event.ContentType == "file" {
		return Error(fmt.Errorf("can't download the file."))
	}

	dialog := application.SaveFileDialog()
	dialog.CanCreateDirectories(true)

	filename := existing_paste_event.Id + ".txt"
	var content []byte
	if existing_paste_event.ContentType == "text" {
		content = []byte(existing_paste_event.Text)
	}
	if existing_paste_event.ContentType == "image" {
		filename = existing_paste_event.Id + ".png"
		data, err := base64.StdEncoding.DecodeString(existing_paste_event.ImageBase64)
		if err != nil {
			return Error(fmt.Errorf("Base64解码失败"))
		}
		content = data
	}
	if existing_paste_event.ContentType == "html" {
		filename = existing_paste_event.Id + ".html"
		content = []byte(existing_paste_event.Html)
		if existing_paste_event.Html == "" {
			content = []byte(existing_paste_event.Text)
		}
	}
	dialog.SetFilename(filename)
	// dialog.SetTitle("Save Document")
	// dialog.SetDefaultFilename("document.txt")
	// dialog.SetFilters([]*application.FileFilter{
	// 	{
	// 		DisplayName: "Text Files (*.txt)",
	// 		Pattern:     "*.txt",
	// 	},
	// })
	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return Error(err)
	}
	if path == "" {
		return Ok(map[string]interface{}{
			"cancel": true,
		})
	}
	file, err := os.Create(path)
	if err != nil {
		return Error(err)
	}
	defer file.Close()
	_, err = file.Write(content)
	if err != nil {
		return Error(err)
	}
	return Ok(map[string]interface{}{})
}

type PasteExtraInfo struct {
	AppName     string
	AppFullPath string
	WindowTitle string
	PlainText   string
}

var unknown_app_id = ""

func get_unknown_app_id(db *gorm.DB) string {
	if unknown_app_id != "" {
		return unknown_app_id
	}
	var existing []models.Device
	if err := db.Where("name = Unknown").Limit(1).Find(&existing).Error; err != nil {
		return ""
	}
	if len(existing) == 0 {
		return ""
	}
	unknown_app_id = existing[0].Id
	return unknown_app_id
}
func get_app_id(db *gorm.DB, title string) string {
	var existing []models.App
	if err := db.Where("name = ?", title).Limit(1).Find(&existing).Error; err != nil {
		return get_unknown_app_id(db)
	}
	if len(existing) == 0 {
		created := &models.App{
			Name:     title,
			UniqueId: title,
			LogoURL:  "",
		}
		if err := db.Create(&created).Error; err != nil {
			return get_unknown_app_id(db)
		}
		return created.Id
	}
	app := existing[0]
	return app.Id
}

var device_id = ""

func get_device_id(db *gorm.DB, machine_id string) string {
	if device_id != "" {
		return device_id
	}
	var existing []models.Device
	if err := db.Where("mac_address = ?", machine_id).Limit(1).Find(&existing).Error; err != nil {
		return ""
	}
	if len(existing) == 0 {
		return ""
	}
	device_id = existing[0].Id
	return device_id
}

func (s *PasteService) HandlePasteText(text string, extra *PasteExtraInfo) (*models.PasteEvent, error) {
	var created_paste_event models.PasteEvent
	// now := time.Now()
	// now_timestamp := strconv.FormatInt(now.UnixMilli(), 10)
	created_paste_event = models.PasteEvent{
		ContentType: "text",
		Text:        text,
		AppId:       get_app_id(s.Biz.DB, extra.AppName),
		DeviceId:    get_device_id(s.Biz.DB, s.Biz.MachineId),
	}
	tx := s.Biz.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := transformer.TextContentDetector(text)
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
			// LastOperationTime: now_timestamp,
			// LastOperationType: 1,
			// CreatedAt:         now_timestamp,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created_paste_event, nil
}

func (s *PasteService) HandlePasteHTML(text string, extra *PasteExtraInfo) (*models.PasteEvent, error) {
	var created_paste_event models.PasteEvent
	r := html.ParseHTMLContent(text)
	details, _ := json.Marshal(&map[string]interface{}{
		"source_url":   r.SourceURL,
		"window_title": extra.WindowTitle,
	})
	created_paste_event = models.PasteEvent{
		ContentType: "html",
		Text:        extra.PlainText,
		Html:        text,
		Details:     string(details),
		AppId:       get_app_id(s.Biz.DB, extra.AppName),
		DeviceId:    get_device_id(s.Biz.DB, s.Biz.MachineId),
	}
	tx := s.Biz.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := []string{"html"}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created_paste_event, nil
}

type PNGFileInfo struct {
	Width         int    `json:"width"`
	Height        int    `json:"height"`
	Size          int    `json:"size"`
	SizeForHumans string `json:"size_for_humans"`
}

func (s *PasteService) HandlePastePNG(image_bytes []byte, extra *PasteExtraInfo) (*models.PasteEvent, error) {
	// now := time.Now()
	// now_timestamp := strconv.FormatInt(now.UnixMilli(), 10)
	encoded := base64.StdEncoding.EncodeToString(image_bytes)
	details := "{}"
	reader := bytes.NewReader(image_bytes)
	info, err := png.DecodeConfig(reader)
	if err == nil {
		t, err := json.Marshal(&map[string]interface{}{
			"width":           info.Width,
			"height":          info.Height,
			"size":            len(image_bytes),
			"size_for_humans": util.AutoByteSize(int64(len(image_bytes))),
			"window_title":    extra.WindowTitle,
		})
		if err == nil {
			details = string(t)
		}
	}
	created_paste_event := models.PasteEvent{
		ContentType: "image",
		ImageBase64: encoded,
		Details:     details,
		AppId:       get_app_id(s.Biz.DB, extra.AppName),
		DeviceId:    get_device_id(s.Biz.DB, s.Biz.MachineId),
	}
	tx := s.Biz.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := []string{"image"}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
			// LastOperationTime: now_timestamp,
			// LastOperationType: 1,
			// CreatedAt:         now_timestamp,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created_paste_event, nil
}

func (s *PasteService) HandlePasteFile(files []string, extra *PasteExtraInfo) (*models.PasteEvent, error) {
	var created_paste_event models.PasteEvent
	// now := time.Now()
	// now_timestamp := strconv.FormatInt(now.UnixMilli(), 10)
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
	if len(results) == 0 {
		return nil, fmt.Errorf("No valid file")
	}
	content, err := json.Marshal(&results)
	if err != nil {
		return nil, err
	}
	details, _ := json.Marshal(&map[string]interface{}{
		"window_title": extra.WindowTitle,
	})
	created_paste_event = models.PasteEvent{
		ContentType:  "file",
		FileListJSON: string(content),
		Details:      string(details),
		AppId:        get_app_id(s.Biz.DB, extra.AppName),
		DeviceId:     get_device_id(s.Biz.DB, s.Biz.MachineId),
	}
	tx := s.Biz.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := []string{"file"}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
			// LastOperationTime: now_timestamp,
			// LastOperationType: 1,
			// CreatedAt:         now_timestamp,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
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
	now_timestamp := strconv.FormatInt(now.UnixMilli(), 10)
	created_paste_event := models.PasteEvent{
		ContentType: "text",
		Text:        body.Text,
		Categories:  []models.CategoryNode{},
		BaseModel: models.BaseModel{
			LastOperationTime: now_timestamp,
			LastOperationType: 1,
			CreatedAt:         now_timestamp,
		},
	}
	s.App.Event.Emit("clipboard:update", created_paste_event)
	return Ok(created_paste_event)
}
