package service

import (
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"devboard/internal/biz"
)

type CommonService struct {
	App *application.App
	Biz *biz.App
}

type OpenWindowBody struct {
	Title  string `json:"title"`
	URL    string `json:"url"`
	HTML   string `json:"html"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

var windows = make(map[string]*application.WebviewWindow)

func (s *CommonService) OpenWindow(body OpenWindowBody) *Result {
	if body.HTML == "" && body.URL == "" {
		return Error(fmt.Errorf("缺少 html 或 url 参数"))
	}
	existing_win := windows[body.URL]
	if existing_win != nil {
		existing_win.Show()
		existing_win.Focus()
		return Ok(map[string]interface{}{
			"ok": true,
		})
	}
	if body.Title == "" {
		body.Title = "新窗口"
	}
	if body.Width == 0 {
		body.Width = 420
	}
	if body.Height == 0 {
		body.Width = 720
	}
	win := s.App.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: body.Title,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
		},
		Width:            body.Width,
		Height:           body.Height,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              body.URL,
		HTML:             body.HTML,
	})
	windows[body.URL] = win
	win.OnWindowEvent(events.Common.WindowClosing, func(e *application.WindowEvent) {
		delete(windows, body.URL)
	})
	win.Focus()
	return Ok(map[string]interface{}{
		"ok": true,
	})
}

type ErrorBody struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

func (s *CommonService) ShowError(body ErrorBody) *Result {
	s.App.Event.Emit("m:show-error", body)
	return Ok(map[string]interface{}{})
}
