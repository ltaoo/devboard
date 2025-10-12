package biz

import (
	"fmt"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"gorm.io/gorm"

	"devboard/config"
)

func New() *BizApp {
	return &BizApp{
		Windows: make(map[string]*application.WebviewWindow),
	}
}

type BizApp struct {
	Name                       string
	Config                     *config.Config
	UserConfig                 *BizConfig
	DB                         *gorm.DB
	App                        *application.App
	Windows                    map[string]*application.WebviewWindow
	ManuallyWriteClipboardTime time.Time
}

func (a *BizApp) SetName(name string) {
	a.Name = name
}
func (a *BizApp) SetApp(app *application.App) {
	a.App = app
}
func (a *BizApp) SetDatabase(db *gorm.DB) {
	a.DB = db
}
func (a *BizApp) SetConfig(config *config.Config) {
	a.Config = config
}
func (a *BizApp) SetUserConfig(config *BizConfig) {
	a.UserConfig = config
}
func (a *BizApp) Ensure() error {
	if a.DB == nil {
		return fmt.Errorf("Please wait the database initialized")
	}
	return nil
}

func (a *BizApp) FindWindow(url string) *application.WebviewWindow {
	existing_win := a.Windows[url]
	if existing_win != nil {
		existing_win.Show()
		existing_win.Focus()
		return existing_win
	}
	return nil
}

func (a *BizApp) AppendWindow(url string, win *application.WebviewWindow) {
	a.Windows[url] = win
	win.OnWindowEvent(events.Common.WindowClosing, func(e *application.WindowEvent) {
		delete(a.Windows, url)
	})
	win.Focus()
}

func (a *BizApp) ShowErrorWindow(search string) {
	url := "/error"
	existing_win := a.Windows[url]
	if existing_win != nil {
		existing_win.SetURL(url + search)
		existing_win.Show()
		existing_win.Focus()
		return
	}
	win := a.App.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Error",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
		},
		Width:              428,
		Height:             260,
		DisableResize:      true,
		ZoomControlEnabled: false,
		BackgroundColour:   application.NewRGB(27, 38, 54),
		URL:                url + search,
	})
	a.Windows[url] = win
	win.OnWindowEvent(events.Common.WindowClosing, func(e *application.WindowEvent) {
		delete(a.Windows, url)
	})
	win.Focus()
}
