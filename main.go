package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"runtime"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/icons"
	"golang.design/x/hotkey"

	"devboard/config"
	"devboard/db"
	_biz "devboard/internal/biz"
	"devboard/internal/service"
	"devboard/models"
	"devboard/pkg/clipboard"
	"devboard/pkg/logger"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

//go:embed all:migrations
var migrations embed.FS

func NotFoundMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rw := &ResponseRecorder{ResponseWriter: w}
		next.ServeHTTP(rw, r)
		if rw.status == http.StatusNotFound {
			data, err := fs.ReadFile(assets, "frontend/dist/index.html")
			if err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			w.Write(data)
		}
	})
}

type ResponseRecorder struct {
	http.ResponseWriter
	status int
}

func (r *ResponseRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	// var database *gorm.DB
	biz := _biz.New()

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	// log := slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))
	app := application.New(application.Options{
		Name:        "DevTool Board",
		Description: "A tools base on clipboard for developer",
		Services:    []application.Service{},
		Assets: application.AssetOptions{
			Handler:        application.AssetFileServerFS(assets),
			Middleware:     NotFoundMiddleware,
			DisableLogging: true,
		},
		Windows: application.WindowsOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		Mac: application.MacOptions{
			// ApplicationShouldTerminateAfterLastWindowClosed: true,
			ActivationPolicy: application.ActivationPolicyAccessory,
		},
		// Logger: log,
	})
	biz.SetApp(app)

	greet_service := application.NewService(&service.GreetService{})
	fs_service := application.NewServiceWithOptions(&service.FileService{
		App: app,
	}, application.ServiceOptions{
		Route: "/file",
	})
	_common_service := &service.CommonService{
		App: app,
		Biz: biz,
	}
	common_service := application.NewService(_common_service)
	_paste_service := service.PasteService{
		App: app,
		Biz: biz,
	}
	paste_service := application.NewService(&_paste_service)
	config_service := application.NewService(&service.ConfigService{
		App: app,
		Biz: biz,
	})
	system_service := application.NewService(&service.SystemService{
		Biz: biz,
	})
	category_service := application.NewService(&service.CategoryService{
		App: app,
		Biz: biz,
	})
	douyin_service := application.NewService(&service.DouyinService{
		App: app,
		Biz: biz,
	})
	sync_service := application.NewService(&service.SyncService{
		App: app,
		Biz: biz,
	})
	remark_service := application.NewService(&service.RemarkService{
		App: app,
		Biz: biz,
	})
	app.RegisterService(greet_service)
	app.RegisterService(fs_service)
	app.RegisterService(common_service)
	app.RegisterService(paste_service)
	app.RegisterService(system_service)
	app.RegisterService(sync_service)
	app.RegisterService(douyin_service)
	app.RegisterService(config_service)
	app.RegisterService(category_service)
	app.RegisterService(remark_service)

	hk := _biz.NewHotkey()

	method_open_setting_window := func() {
		_common_service.OpenWindow(service.OpenWindowBody{
			Title: "Settings",
			URL:   "/settings_system",
		})
	}
	method_quit := func() {
		hk.Unregister()
		app.Quit()
	}
	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:               "Devboard",
		MaximiseButtonState: application.ButtonDisabled,
		MinimiseButtonState: application.ButtonDisabled,
		// AlwaysOnTop:         true,
		// Hidden:        true,
		DisableResize: true,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			// TitleBar:                application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
		KeyBindings: map[string]func(window application.Window){
			"CmdOrCtrl+,": func(window application.Window) {
				method_open_setting_window()
			},
			"CmdOrCtrl+Q": func(window application.Window) {
				method_quit()
			},
			// "Escape": func(window application.Window) {
			// 	window.Close()
			// },
		},
		Width:            450,
		Height:           680,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	app.KeyBinding.Add("CmdOrCtrl+,", func(win application.Window) {
		method_open_setting_window()
	})
	app.KeyBinding.Add("CmdOrCtrl+Q", func(win application.Window) {
		method_quit()
	})
	// app.KeyBinding.Add("Escape", func(win application.Window) {
	// 	fmt.Println("escape")
	// 	win.Close()
	// })
	system_tray := app.SystemTray.New()
	system_tray.OnClick(func() {
		system_tray.OpenMenu()
	})
	// system_tray.OnMouseLeave(func() {
	// 	register_shortcut(win, hk)
	// })
	// Register a hook to hide the window when the window is closing
	win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		win.Hide()
		e.Cancel()
	})
	// win.RegisterHook(events.Common.WindowLostFocus, func(e *application.WindowEvent) {
	// 	win.Close()
	// })
	if runtime.GOOS == "darwin" {
		system_tray.SetTemplateIcon(icons.SystrayMacTemplate)
	}
	menu := app.NewMenu()
	m_main := menu.Add("Show Devboard")
	if runtime.GOOS == "darwin" {
		m_main.SetAccelerator("CmdOrCtrl+Shift+M")
	}
	m_main.OnClick(func(ctx *application.Context) {
		win.Show()
		win.Focus()
	})
	m_setting := menu.Add("Settings")
	m_setting.SetAccelerator("CmdOrCtrl+,")
	m_setting.OnClick(func(ctx *application.Context) {
		method_open_setting_window()
	})
	m_quit := menu.Add("Quit")
	m_quit.SetAccelerator("CmdOrCtrl+Q")
	m_quit.OnClick(func(ctx *application.Context) {
		method_quit()
	})
	system_tray.SetMenu(menu)

	// ctx_menu := application.NewContextMenu("main")
	// ctx_menu.Add("Refresh").OnClick(func(ctx *application.Context) {
	// 	app.Event.Emit("m:refresh")
	// })
	refresh_menu_text := "Refresh"
	if runtime.GOOS == "darwin" {
		refresh_menu_text = "Reload"
	}
	ctx_menu := app.ContextMenu.New()
	m_refresh := ctx_menu.Add(refresh_menu_text)
	m_refresh.SetAccelerator("Cmd+R")
	m_refresh.OnClick(func(data *application.Context) {
		app.Event.Emit("m:refresh")
	})
	app.ContextMenu.Add("refresh", ctx_menu)

	// win.OnWindowEvent(events.Common.WindowFilesDropped, func(e *application.WindowEvent) {
	// 	fmt.Println(e.Context().DroppedFiles())
	// })

	// Create a goroutine that emits an event containing the current time every second.
	// The frontend can listen to this event and update the UI accordingly.
	// go func() {
	// 	for {
	// 		now := time.Now().Format(time.RFC1123)
	// 		app.Event.Emit("time", now)
	// 		time.Sleep(time.Second)
	// 	}
	// }()
	go func() {
		ch := clipboard.Watch(context.TODO())
		var created_paste_event *models.PasteEvent
		// var prev_paste_event models.PasteEvent
		// if err := biz_app.DB.First(&prev_paste_event).Error; err != nil {
		// }
		for data := range ch {
			fmt.Println(data.Type)
			now := time.Now()
			if now.Sub(biz.ManuallyWriteClipboardTime) < time.Second*3 {
				continue
			}
			if data.Type == "public.file-url" {
				if files, ok := data.Data.([]string); ok {
					created, err := _paste_service.HandlePasteFile(files)
					if err != nil {
						return
					}
					created_paste_event = created
				}
			}
			if data.Type == "public.utf8-plain-text" {
				if text, ok := data.Data.(string); ok {
					created, err := _paste_service.HandlePasteText(text)
					if err != nil {
						return
					}
					created_paste_event = created
				}
			}
			if data.Type == "public.html" {
				if text, ok := data.Data.(string); ok {
					created, err := _paste_service.HandlePasteHTML(text)
					if err != nil {
						return
					}
					created_paste_event = created
				}
			}
			if data.Type == "public.png" {
				if f, ok := data.Data.([]byte); ok {
					created, err := _paste_service.HandlePastePNG(f)
					if err != nil {
						return
					}
					created_paste_event = created
				}
			}
			if created_paste_event != nil {
				app.Event.Emit("clipboard:update", created_paste_event)
			}
		}
	}()
	app.Event.On("m:show-error", func(event *application.CustomEvent) {
		body := event.Data.(service.ErrorBody)
		search := fmt.Sprintf("?title=%v&desc=%v", body.Title, body.Content)
		biz.ShowErrorWindow(search)
	})
	go func() {
		cfg, err := config.LoadConfig()
		if err != nil {
			t := fmt.Sprintf("Failed to load config: %v", err)
			biz.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			win.Hide()
			return
		}
		logger := logger.NewLogger(cfg.LogLevel)
		defer logger.Sync()
		database, err := db.NewDatabase(cfg)
		if err != nil {
			t := fmt.Sprintf("Failed to connect to database, %v", err)
			fmt.Println(t)
			biz.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			win.Hide()
			return
		}
		migrator := db.NewMigrator(cfg, logger, &migrations)
		if err := migrator.MigrateUp(); err != nil {
			t := fmt.Sprintf("Failed to run migrations, %v", err)
			biz.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			win.Hide()
			return
		}
		db.Seed(database)
		biz.SetName(cfg.ProductName)
		biz.SetDatabase(database)
		biz.SetConfig(cfg)
		biz_config := _biz.NewBizConfig(cfg.UserConfigDir, cfg.UserConfigName)
		biz_config.InitializeConfig()
		biz.SetUserConfig(biz_config)
		// win.Show()
	}()
	go func() {
		register_global_shortcut(win, hk)
	}()
	// Run the application. This blocks until the application has been exited.
	err := app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		fmt.Println(err.Error())
	}
}

func register_global_shortcut(win *application.WebviewWindow, hk *hotkey.Hotkey) {
	// hk := hotkey.New([]hotkey.Modifier{hotkey.ModCmd, hotkey.ModShift}, hotkey.KeyM)
	err := hk.Register()
	if err != nil {
		log.Fatalf("hotkey: failed to register hotkey: %v", err)
		return
	}
	// log.Printf("hotkey: %v is registered\n", hk)
	<-hk.Keydown()
	// log.Printf("hotkey: %v is down\n", hk)
	<-hk.Keyup()
	// log.Printf("hotkey: %v is up\n", hk)
	hk.Unregister()
	// log.Printf("hotkey: %v is unregistered\n", hk)
	if win.IsVisible() {
		win.Hide()
	} else {
		win.Show()
		win.Focus()
	}
	register_global_shortcut(win, hk)
}
