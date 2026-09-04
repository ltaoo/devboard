package main

import (
	"context"
	"embed"
	"fmt"
	"time"

	"github.com/denisbrodbeck/machineid"
	"github.com/ltaoo/clipboard-go"
	"github.com/ltaoo/velo"
	velo_error "github.com/ltaoo/velo/error"
	"github.com/ltaoo/velo/tray"
	"github.com/ltaoo/velo/webview"

	"devboard/config"
	"devboard/db"
	"devboard/internal/biz"
	"devboard/internal/controller"
	"devboard/internal/routes"
	"devboard/internal/service"
	"devboard/models"
	"devboard/pkg/autostart"
	"devboard/pkg/logger"
	"devboard/pkg/system"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed all:migrations
var migrations embed.FS

//go:embed build/appicon.png
var app_icon []byte

//go:embed assets/brand/devboard-tray.png
var tray_icon []byte

func main() {
	quit_on_last_window_closed := false
	app := velo.NewApp(&velo.VeloAppOpt{
		Mode:                   velo.ModeBridge,
		AppName:                "DevTool Board",
		Title:                  "Devboard",
		IconData:               app_icon,
		QuitOnLastWindowClosed: &quit_on_last_window_closed,
		HideDockIcon:           true,
	})

	machine_id, err := machineid.ID()
	if err != nil {
		show_startup_error(fmt.Errorf("failed to generate machine id: %w", err))
		return
	}
	cfg, err := config.LoadConfig()
	if err != nil {
		show_startup_error(fmt.Errorf("failed to load config: %w", err))
		return
	}
	app_logger := logger.NewLogger(cfg.LogLevel)
	defer app_logger.Sync()
	database, err := db.NewDatabase(cfg)
	if err != nil {
		show_startup_error(fmt.Errorf("failed to connect to database: %w", err))
		return
	}
	migrator := db.NewMigrator(cfg, app_logger, &migrations)
	if err := migrator.MigrateUp(); err != nil {
		show_startup_error(fmt.Errorf("failed to run migrations: %w", err))
		return
	}
	db.Seed(database, machine_id)

	biz_app := biz.New(app).
		SetName(cfg.ProductName).
		SetDatabase(database).
		SetConfig(cfg).
		SetMachineId(machine_id).
		InitializeControllerMap().
		InitializeUserConfig(cfg)
	service.RegisterRoutes(app, biz_app)

	main_window := app.NewWebview(&velo.VeloWebviewOpt{
		Name:                   "main",
		Title:                  "Devboard",
		Width:                  450,
		Height:                 680,
		DisableResize:          true,
		DisableMinimize:        true,
		DisableMaximize:        true,
		ReloadContextMenu:      true,
		BackgroundColor:        velo.NewRGB(27, 38, 54),
		MacBackdropTranslucent: true,
		MacTitleBarHeight:      50,
		HiddenOnTaskbar:        true,
		Pathname:               "/home/index",
		FrontendFS:             assets,
		EntryPage:              "dist/index.html",
		HideOnClose:            true,
		OnReopen: func() {
			biz_app.MainWindow.Show()
			biz_app.MainWindow.Focus()
		},
	})
	biz_app.SetMainWindow(main_window).SetReady()

	setup_tray(app, biz_app, main_window)
	start_background_services(app, biz_app, cfg, machine_id, app_logger)
	app.Run()
}

func show_startup_error(err error) {
	fmt.Println(err)
	velo_error.ShowErrorDialog(err.Error())
}

func setup_tray(app *velo.Box, biz_app *biz.BizApp, main_window *webview.Webview) {
	tray.Setup(&tray.Tray{
		Icon:       tray_icon,
		IsTemplate: true,
		Tooltip:    "Devboard",
		Menu: &tray.Menu{Items: []*tray.MenuItem{
			{Label: "Show Devboard", Click: func(_ *tray.MenuItem) {
				main_window.Show()
				main_window.Focus()
			}},
			{Label: "Settings", Shortcut: "CmdOrCtrl+,", Click: func(_ *tray.MenuItem) {
				_, _ = biz_app.OpenSettingsWindow()
			}},
			{IsSeparator: true},
			{Label: "Quit", Shortcut: "CmdOrCtrl+Q", Click: func(_ *tray.MenuItem) {
				tray.Quit()
				app.Quit()
			}},
		}},
	})
}

func start_background_services(app *velo.Box, biz_app *biz.BizApp, cfg *config.Config, machine_id string, app_logger *logger.Logger) {
	go func() {
		router := routes.SetupRouter(biz_app.DB, app_logger, cfg, machine_id)
		if err := router.Run(cfg.ServerAddress); err != nil {
			fmt.Printf("failed to start server: %v\n", err)
		}
	}()
	go watch_clipboard(app, biz_app, machine_id)
	go register_saved_shortcut(biz_app)
	go sync_autostart(biz_app)
}

func watch_clipboard(app *velo.Box, biz_app *biz.BizApp, machine_id string) {
	updates := clipboard.Watch(context.Background())
	for data := range updates {
		if time.Since(biz_app.ManuallyWriteClipboardTime) < 3*time.Second {
			continue
		}
		foreground_process, err := system.GetForegroundProcess()
		if err != nil || foreground_process == nil {
			continue
		}
		extra := &controller.PasteExtraInfo{
			AppName:     foreground_process.Name,
			AppFullPath: foreground_process.ExecuteFullPath,
			WindowTitle: foreground_process.WindowTitle,
			MachineId:   machine_id,
		}
		created := create_paste_event(biz_app, data, extra)
		if created != nil {
			app.SendMessage(map[string]interface{}{"name": "clipboard:update", "data": created})
		}
	}
}

func create_paste_event(biz_app *biz.BizApp, data clipboard.ClipboardContent, extra *controller.PasteExtraInfo) *models.PasteEvent {
	switch data.Type {
	case "public.utf8-plain-text":
		text, ok := data.Data.(string)
		if !ok || text == "" {
			return nil
		}
		created, _ := biz_app.HandlePasteText(text, extra)
		return created
	case "public.html":
		html, ok := data.Data.(string)
		if !ok {
			return nil
		}
		extra.PlainText, _ = clipboard.ReadText()
		created, _ := biz_app.HandlePasteHTML(html, extra)
		return created
	case "public.png":
		image, ok := data.Data.([]byte)
		if !ok {
			return nil
		}
		created, _ := biz_app.HandlePastePNG(image, extra)
		return created
	case "public.file-url":
		files, ok := data.Data.([]string)
		if !ok {
			return nil
		}
		created, _ := biz_app.HandlePasteFile(files, extra)
		return created
	default:
		return nil
	}
}

func register_saved_shortcut(biz_app *biz.BizApp) {
	shortcut := biz_app.Perferences.Value.Shortcut.ToggleMainWindowVisible
	if shortcut != "" {
		if err := biz_app.RegisterShortcutWithCommand(shortcut, "ToggleMainWindowVisible"); err != nil {
			fmt.Printf("register shortcut failed: %v\n", err)
		}
	}
}

func sync_autostart(biz_app *biz.BizApp) {
	auto_start := biz_app.Perferences.Value.AutoStart
	service := autostart.New(biz_app.Name)
	if auto_start && !service.IsEnabled() {
		if err := service.Enable(); err != nil {
			fmt.Printf("failed to enable autostart: %v\n", err)
		}
	} else if !auto_start && service.IsEnabled() {
		if err := service.Disable(); err != nil {
			fmt.Printf("failed to disable autostart: %v\n", err)
		}
	}
}
