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

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/internal/controller"
	"devboard/internal/transformer"
	"devboard/models"
	"devboard/pkg/html"
	"devboard/pkg/util"
)

type PasteService struct {
	App *application.App
	Biz *biz.BizApp
	Con *controller.PasteController
}

func NewPasteService(app *application.App, biz *biz.BizApp) *PasteService {
	return &PasteService{
		App: app,
		Biz: biz,
		Con: controller.NewPasteController(biz.DB, biz.MachineId),
	}
}

func (s *PasteService) FetchPasteEventList(body controller.PasteListBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	if s.Con == nil {
		return Error(fmt.Errorf("Missing the controller"))
	}
	list, err := s.Con.FetchPasteEventList(body)
	if err != nil {
		return Error(err)
	}
	return Ok(list)
}

func (s *PasteService) FetchPasteEventProfile(body controller.PasteProfileBody) *Result {
	if s.Biz.DB == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	profile, err := s.Con.FetchPasteEventProfile(body)
	if err != nil {
		return Error(err)
	}
	return Ok(profile)
}

func (s *PasteService) DeletePasteEvent(body controller.PasteEventBody) *Result {
	_, err := s.Con.DeletePasteEvent(body)
	if err != nil {
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

type FileInPasteBoard struct {
	Name         string `json:"name"`
	AbsolutePath string `json:"absolute_path"`
	MimeType     string `json:"mime_type"`
}

func (s *PasteService) Write(body controller.PasteWriteBody) *Result {
	if s.Biz.DB == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	s.Biz.ManuallyWriteClipboardTime = time.Now()
	_, err := s.Con.WritePasteContent(body)
	if err != nil {
		return Error(err)
	}
	return Ok(nil)
}

func (f *PasteService) DownloadContentWithPasteEventId(body controller.PasteProfileBody) *Result {
	existing_paste_event, err := f.Con.FetchPasteEventProfile(body)
	if err != nil {
		return Error(err)
	}
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
func app_name_to_id(name string) string {
	// 转换为小写
	result := strings.ToLower(name)

	// 使用 strings.Fields 分割所有空白字符，然后用下划线连接
	words := strings.Fields(result)
	result = strings.Join(words, "_")

	return result
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
			BaseModel: models.BaseModel{
				Id: app_name_to_id(title),
			},
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
