package biz

import (
	"fmt"
	"net/url"
	"time"

	"github.com/ltaoo/velo"
	"github.com/ltaoo/velo/webview"
	"golang.design/x/hotkey"
	"gorm.io/gorm"

	"devboard/config"
	"devboard/internal/controller"
	"devboard/models"
	"devboard/pkg/system"
	// "devboard/internal/service"
)

type ControllerMap struct {
	Paste    *controller.PasteController
	Category *controller.CategoryController
	Remark   *controller.PasteEventRemarkController
	App      *controller.AppController
	Device   *controller.DeviceController
}

type BizApp struct {
	app                        *velo.Box
	Name                       string
	DB                         *gorm.DB
	Config                     *config.Config
	Perferences                *UserSettings
	MachineId                  string
	MainWindow                 *webview.Webview
	Hotkey                     *hotkey.Hotkey
	HotkeyMap                  map[string]*hotkey.Hotkey // 以 快捷键 为 key，hk 实例为值
	CommandHotKeyMap           map[string]*hotkey.Hotkey // 以 Command 为 key，kh 实例为值
	ManuallyWriteClipboardTime time.Time
	ControllerMap              *ControllerMap
	Ready                      bool

	prev_app *system.ForegroundProcess
}

func New(app *velo.Box) *BizApp {
	// hk := NewHotkey()

	return &BizApp{
		app:              app,
		HotkeyMap:        make(map[string]*hotkey.Hotkey),
		CommandHotKeyMap: make(map[string]*hotkey.Hotkey),
	}
}

func (a *BizApp) SetName(name string) *BizApp {
	a.Name = name
	return a
}
func (a *BizApp) SetApp(app *velo.Box) *BizApp {
	a.app = app
	return a
}
func (a *BizApp) SetDatabase(db *gorm.DB) *BizApp {
	a.DB = db
	return a
}
func (a *BizApp) SetMachineId(id string) *BizApp {
	a.MachineId = id
	return a
}
func (a *BizApp) SetConfig(config *config.Config) *BizApp {
	a.Config = config
	return a
}
func (a *BizApp) InitializeUserConfig(cfg *config.Config) *BizApp {
	biz_config := NewBizConfig(cfg.UserConfigDir, cfg.UserConfigName)
	biz_config.InitializeConfig()
	a.Perferences = biz_config
	return a
}
func (a *BizApp) SetUserConfig(config *UserSettings) *BizApp {
	a.Perferences = config
	return a
}
func (a *BizApp) InitializeControllerMap() *BizApp {
	a.ControllerMap = &ControllerMap{
		Paste:    controller.NewPasteController(a.DB, a.MachineId),
		Remark:   controller.NewRemarkController(a.DB),
		Category: controller.NewCategoryController(a.DB),
		Device:   controller.NewDeviceController(a.DB),
		App:      controller.NewAppController(a.DB),
	}
	return a
}
func (a *BizApp) SetMainWindow(win *webview.Webview) *BizApp {
	a.MainWindow = win
	return a
}

func (a *BizApp) SetReady() {
	a.Ready = true
}

func (a *BizApp) Ensure() error {
	if a.DB == nil {
		return fmt.Errorf("Please wait the database initialized")
	}
	return nil
}

func (a *BizApp) HandlePasteText(text string, extra *controller.PasteExtraInfo) (*models.PasteEvent, error) {
	return a.ControllerMap.Paste.HandlePasteText(text, extra)
}
func (a *BizApp) HandlePasteHTML(text string, extra *controller.PasteExtraInfo) (*models.PasteEvent, error) {
	return a.ControllerMap.Paste.HandlePasteHTML(text, extra)
}
func (a *BizApp) HandlePastePNG(img []byte, extra *controller.PasteExtraInfo) (*models.PasteEvent, error) {
	return a.ControllerMap.Paste.HandlePastePNG(img, extra)
}
func (a *BizApp) HandlePasteFile(files []string, extra *controller.PasteExtraInfo) (*models.PasteEvent, error) {
	return a.ControllerMap.Paste.HandlePasteFile(files, extra)
}

func (a *BizApp) ToggleMainWindowVisible() {
	fmt.Println("[]ToggleMainWindowVisible", a.MainWindow.IsVisible())
	if a.MainWindow.IsFocused() {
		a.MainWindow.Hide()
		fmt.Println("after main window hide, check there's the prev app")
		if a.prev_app != nil {
			fmt.Println(a.prev_app.Name)
			system.ActiveProcess(a.prev_app.Reference)
			a.prev_app = nil
		}
		return
	}
	p, err := system.GetForegroundProcess()
	if err == nil {
		fmt.Println("after main window show, save the app success", p.Name)
		a.prev_app = p
	}
	a.MainWindow.Show()
	a.MainWindow.Focus()
}

func (a *BizApp) ShowErrorWindow(search string) {
	window_key := "/error"
	a.app.OpenWindow(&velo.VeloWebviewOpt{
		Name:                   window_key,
		Title:                  "Error - Devboard",
		Width:                  428,
		Height:                 260,
		DisableResize:          true,
		DisableMinimize:        true,
		DisableMaximize:        true,
		DisableZoom:            true,
		BackgroundColor:        velo.NewRGB(27, 38, 54),
		MacBackdropTranslucent: true,
		MacTitleBarHeight:      50,
		Pathname:               window_key + search,
	})
}

type OpenWindowBody struct {
	Title  string `json:"title"`
	URL    string `json:"url"`
	HTML   string `json:"html"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

func (s *BizApp) OpenWindow(body OpenWindowBody) (int, error) {
	if body.HTML == "" && body.URL == "" {
		return 0, fmt.Errorf("缺少 html 或 url 参数")
	}
	if body.Title == "" {
		body.Title = "新窗口"
	}
	if body.Width == 0 {
		body.Width = 420
	}
	if body.Height == 0 {
		body.Height = 720
	}
	window_url := body.URL
	is_html := window_url == ""
	if is_html {
		window_url = "data:text/html;charset=utf-8," + url.QueryEscape(body.HTML)
	}
	window_key := body.URL
	if window_key == "" {
		window_key = window_url
	}
	window_options := &velo.VeloWebviewOpt{
		Name:                   window_key,
		Title:                  body.Title,
		Width:                  body.Width,
		Height:                 body.Height,
		BackgroundColor:        velo.NewRGB(27, 38, 54),
		MacBackdropTranslucent: true,
		MacTitleBarHeight:      50,
	}
	if is_html {
		window_options.URL = window_url
	} else {
		window_options.Pathname = window_url
	}
	s.app.OpenWindow(window_options)
	return 1, nil
}

func (s *BizApp) OpenSettingsWindow() (int, error) {
	return s.OpenWindow(OpenWindowBody{
		Title: "Settings",
		URL:   "/settings",
	})
}

type ErrorBody struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

func (s *BizApp) ShowError(body ErrorBody) error {
	search := "?title=" + url.QueryEscape(body.Title) + "&desc=" + url.QueryEscape(body.Content)
	s.ShowErrorWindow(search)
	return nil
}

func (s *BizApp) Quit() {
	s.app.Quit()
}

func (a *BizApp) DisableShortcut() {

}

func (a *BizApp) RegisterShortcut(vvv string, handler func(biz *BizApp), error_handler func(err error)) (*hotkey.Hotkey, error) {
	hk, err := NewHotkey(vvv)
	if err != nil {
		return nil, err
	}
	var register_global_shortcut func(hk *hotkey.Hotkey)
	register_global_shortcut = func(hk *hotkey.Hotkey) {
		// hk := hotkey.New([]hotkey.Modifier{hotkey.ModCmd, hotkey.ModShift}, hotkey.KeyM)
		if err := hk.Register(); err != nil {
			error_handler(err)
			// t := fmt.Sprintf("hotkey: failed to register hotkey: %v", err)
			// a.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			return
		}
		fmt.Printf("hotkey: %v is registered\n", hk)
		<-hk.Keydown()
		fmt.Printf("hotkey: %v is down\n", hk)
		<-hk.Keyup()
		fmt.Printf("hotkey: %v is up\n", hk)
		if err := hk.Unregister(); err != nil {
			// t := fmt.Sprintf("hotkey: failed to unregister hotkey: %v", err)
			// a.ShowErrorWindow("?" + url.QueryEscape("title=Shortcut&desc="+t))
			error_handler(err)
			return
		}
		fmt.Printf("invoke handler\n")
		handler(a)
		register_global_shortcut(hk)
	}
	go func() {
		register_global_shortcut(hk)
	}()
	a.HotkeyMap[vvv] = hk
	return hk, nil
}
func (a BizApp) UnregisterShortcut(vvv string) error {
	fmt.Println("[SERVICE]UnregisterShortcut", vvv)
	hk, existing := a.HotkeyMap[vvv]
	if !existing {
		return fmt.Errorf("not found registered shortcut")
	}
	return hk.Unregister()
}

type CommandHandler struct {
	Handler     func(biz *BizApp)
	Description string
}

var CommandHandlerMap = map[string]CommandHandler{
	"ToggleMainWindowVisible": {
		Description: "Open or hide the main window",
		Handler: func(biz *BizApp) {
			biz.ToggleMainWindowVisible()

		},
	},
}

func (a *BizApp) RegisterShortcutWithCommand(shortcut string, command string) error {
	handler, ok := CommandHandlerMap[command]
	if !ok {
		return fmt.Errorf("Not valid command")
	}
	existing_shortcut, ok := a.HotkeyMap[shortcut]
	if ok {
		existing_shortcut.Unregister()
	}
	existing_command, ok := a.CommandHotKeyMap[command]
	if ok {
		existing_command.Unregister()
	}
	hk, err := a.RegisterShortcut(shortcut, func(biz *BizApp) {
		handler.Handler(a)
	}, func(err error) {
		//
	})
	if err != nil {
		return err
	}
	a.CommandHotKeyMap[command] = hk
	return nil
}

// func (a *BizApp) UnregisterShortcut(shortcut string) error {
// 	a.UnRegisterShortcut(shortcut)
// 	return nil
// }
