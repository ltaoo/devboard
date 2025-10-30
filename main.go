package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"runtime"
	"time"

	"github.com/denisbrodbeck/machineid"
	"github.com/gin-gonic/gin"
	"github.com/ltaoo/clipboard-go"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/icons"

	"devboard/config"
	"devboard/db"
	_biz "devboard/internal/biz"
	"devboard/internal/controller"
	"devboard/internal/routes"
	"devboard/internal/service"
	"devboard/models"
	"devboard/pkg/logger"
	"devboard/pkg/system"
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
func GinMiddleware(engine *gin.Engine) application.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Let Wails handle the `/wails` route
			if r.URL.Path == "/wails" {
				next.ServeHTTP(w, r)
				return
			}
			// Let Gin handle everything else
			engine.ServeHTTP(w, r)
		})
	}
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
	biz := _biz.New(app)

	fmt.Println("[LOG][Before Ready]database is ready")
	app.RegisterService(application.NewService(service.NewPasteService(app, biz)))
	app.RegisterService(application.NewService(service.NewCategoryService(app, biz)))
	app.RegisterService(application.NewService(service.NewRemarkService(app, biz)))
	app.RegisterService(application.NewService(service.NewSynchronizeService(app, biz)))
	app.RegisterService(application.NewService(service.NewSystemService(app, biz)))
	app.RegisterService(application.NewService(service.NewCommonService(app, biz)))
	app.RegisterService(application.NewService(&service.DouyinService{App: app, Biz: biz}))
	app.RegisterService(application.NewService(&service.ConfigService{App: app, Biz: biz}))
	app.RegisterService(application.NewServiceWithOptions(&service.FileService{App: app}, application.ServiceOptions{Route: "/file"}))
	fmt.Println("[LOG][Before Ready]service register is completed")

	go func() {
		machine_id, err := machineid.ID()
		if err != nil {
			t := fmt.Sprintf("Failed to generate machine id, %v", err)
			biz.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			return
		}
		cfg, err := config.LoadConfig()
		if err != nil {
			t := fmt.Sprintf("Failed to load config: %v", err)
			biz.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			return
		}
		logger := logger.NewLogger(cfg.LogLevel)
		defer logger.Sync()
		database, err := db.NewDatabase(cfg)
		if err != nil {
			t := fmt.Sprintf("Failed to connect to database, %v", err)
			fmt.Println(t)
			biz.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			return
		}
		migrator := db.NewMigrator(cfg, logger, &migrations)
		if err := migrator.MigrateUp(); err != nil {
			t := fmt.Sprintf("Failed to run migrations, %v", err)
			biz.ShowErrorWindow("?" + url.QueryEscape("title=InitializeFailed&desc="+t))
			return
		}
		db.Seed(database, machine_id)

		biz.
			SetName(cfg.ProductName).
			SetDatabase(database).
			SetConfig(cfg).
			SetMachineId(machine_id).
			InitializeControllerMap().
			InitializeUserConfig(cfg)

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
				// WindowLevel:             application.MacWindowLevelModalPanel,
				// TitleBar:                application.MacTitleBarHiddenInset,
			},
			Windows: application.WindowsWindow{
				HiddenOnTaskbar: true,
			},
			KeyBindings: map[string]func(window application.Window){
				"CmdOrCtrl+,": func(window application.Window) {
					biz.OpenSettingsWindow()
				},
				"CmdOrCtrl+Q": func(window application.Window) {
					biz.Quit()
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
			biz.OpenSettingsWindow()
		})
		app.KeyBinding.Add("CmdOrCtrl+Q", func(win application.Window) {
			biz.Quit()
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
		if runtime.GOOS == "darwin" {
			system_tray.SetTemplateIcon(icons.SystrayMacTemplate)
		}
		// Register a hook to hide the window when the window is closing
		menu := app.NewMenu()
		m_main := menu.Add("Show Devboard")
		// if runtime.GOOS == "darwin" {
		// 	m_main.SetAccelerator("CmdOrCtrl+Shift+M")
		// }
		// if runtime.GOOS == "windows" {
		// 	m_main.SetAccelerator("CmdOrCtrl+Backquote")
		// }
		m_main.OnClick(func(ctx *application.Context) {
			win.Show()
			win.Focus()
		})
		m_setting := menu.Add("Settings")
		m_setting.SetAccelerator("CmdOrCtrl+,")
		m_setting.OnClick(func(ctx *application.Context) {
			biz.OpenSettingsWindow()
		})
		m_quit := menu.Add("Quit")
		m_quit.SetAccelerator("CmdOrCtrl+Q")
		m_quit.OnClick(func(ctx *application.Context) {
			biz.Quit()
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

		fmt.Println("[LOG][Before Ready]the system tray and menus is ready")
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
			router := routes.SetupRouter(database, logger, cfg, machine_id)
			if err := router.Run(cfg.ServerAddress); err != nil {
				logger.Fatal("Failed to start server", err)
			}
		}()
		go func() {
			ch := clipboard.Watch(context.TODO())
			for data := range ch {
				var created_paste_event *models.PasteEvent
				foreground_process, _ := system.GetForegroundProcess()
				extra := &controller.PasteExtraInfo{
					AppName:     foreground_process.Name,
					AppFullPath: foreground_process.ExecuteFullPath,
					WindowTitle: foreground_process.WindowTitle,
					MachineId:   machine_id,
				}
				// fmt.Println("[LOG]paste event within ", window_title)
				// fmt.Println("[LOG]paste event type is ", data.Type)
				now := time.Now()
				if now.Sub(biz.ManuallyWriteClipboardTime) < time.Second*3 {
					continue
				}
				if data.Type == "public.utf8-plain-text" {
					if text, ok := data.Data.(string); ok {
						if text == "" {
							return
						}
						created, err := biz.HandlePasteText(text, extra)
						if err != nil {
							return
						}
						created_paste_event = created
					}
				}
				if data.Type == "public.html" {
					if html, ok := data.Data.(string); ok {
						text, _ := clipboard.ReadText()
						extra.PlainText = text
						created, err := biz.HandlePasteHTML(html, extra)
						if err != nil {
							return
						}
						created_paste_event = created
					}
				}
				if data.Type == "public.png" {
					if f, ok := data.Data.([]byte); ok {
						created, err := biz.HandlePastePNG(f, extra)
						if err != nil {
							return
						}
						created_paste_event = created
					}
				}
				if data.Type == "public.file-url" {
					if files, ok := data.Data.([]string); ok {
						created, err := biz.HandlePasteFile(files, extra)
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
		go func() {
			// biz.RegisterShortcutWithCommand("MetaLeft+BackQuote", "ToggleMainWindowVisible")
			biz.RegisterShortcut("MetaLeft+BackQuote", func(biz *_biz.BizApp) {
				fmt.Println("MetaLeft+BackQuote")
				if win.IsVisible() {
					win.Hide()
				} else {
					win.Show()
					win.Focus()
				}
			}, func(err error) {
				// ...
			})
		}()

		win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
			win.Hide()
			e.Cancel()
		})
		// win.RegisterHook(events.Common.WindowLostFocus, func(e *application.WindowEvent) {
		// 	win.Close()
		// })
		app.Event.On("m:show-error", func(event *application.CustomEvent) {
			body := event.Data.(_biz.ErrorBody)
			search := fmt.Sprintf("?title=%v&desc=%v", body.Title, body.Content)
			biz.ShowErrorWindow(search)
		})
		app.Event.On("m:hide-main-window", func(event *application.CustomEvent) {
			win.Hide()
		})
		fmt.Println("----------------")
		fmt.Println("--- The Application is Ready ---")
		fmt.Println("----------------")
		app.Event.Emit("lifecycle:ready")
		biz.SetReady()
	}()
	// Run the application. This blocks until the application has been exited.
	if err := app.Run(); err != nil {
		// If an error occurred while running the application, log it and exit.
		fmt.Println(err.Error())
	}
}
