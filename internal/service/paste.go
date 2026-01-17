package service

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/internal/biz"
	"devboard/internal/controller"
	"devboard/models"
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

func (s *PasteService) FetchPasteEventList(body controller.PasteListBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	list, err := s.Biz.ControllerMap.Paste.FetchPasteEventList(body)
	if err != nil {
		return Error(err)
	}
	return Ok(list)
}

func (s *PasteService) FetchPasteEventProfile(body controller.PasteProfileBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	profile, err := s.Biz.ControllerMap.Paste.FetchPasteEventProfile(body)
	if err != nil {
		return Error(err)
	}
	return Ok(profile)
}

func (s *PasteService) DeletePasteEvent(body controller.PasteEventBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	_, err := s.Biz.ControllerMap.Paste.DeletePasteEvent(body)
	if err != nil {
		return Error(err)
	}
	return Ok(nil)
}

type PasteEventPreviewBody struct {
	EventId string `json:"paste_event_id"`
	Focus   bool   `json:"focus"`
}

func (s *PasteService) PreviewPasteEvent(body PasteEventPreviewBody) *Result {
	if body.EventId == "" {
		return Error(fmt.Errorf("缺少 paste_event_id 参数"))
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
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	s.Biz.ManuallyWriteClipboardTime = time.Now()
	_, err := s.Biz.ControllerMap.Paste.WritePasteContent(body)
	if err != nil {
		return Error(err)
	}
	return Ok(nil)
}

func (s *PasteService) DownloadContentWithPasteEventId(body controller.PasteProfileBody) *Result {
	if s.Biz.DB == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	existing_paste_event, err := s.Biz.ControllerMap.Paste.FetchPasteEventProfile(body)
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

func (s *PasteService) GetPasteImageAsTempFile(body controller.PasteProfileBody) *Result {
	if s.Biz.DB == nil {
		return Error(fmt.Errorf("请先初始化数据库"))
	}
	existing_paste_event, err := s.Biz.ControllerMap.Paste.FetchPasteEventProfile(body)
	if err != nil {
		return Error(err)
	}
	if existing_paste_event.ContentType != "image" {
		return Error(fmt.Errorf("not an image"))
	}

	data, err := base64.StdEncoding.DecodeString(existing_paste_event.ImageBase64)
	if err != nil {
		return Error(fmt.Errorf("Base64解码失败"))
	}

	filename := fmt.Sprintf("paste_image_%s.png", existing_paste_event.Id)
	path := filepath.Join(os.TempDir(), filename)

	file, err := os.Create(path)
	if err != nil {
		return Error(err)
	}
	defer file.Close()
	_, err = file.Write(data)
	if err != nil {
		return Error(err)
	}
	return Ok(path)
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
