package main

import (
	"context"
	"embed"
	_ "embed"
	"encoding/base64"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"devboard/config"
	"devboard/db"
	"devboard/internal/biz"
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

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	// var database *gorm.DB
	biz := biz.New()

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "DevTool Board",
		Description: "A tools base on clipboard for developer",
		Services:    []application.Service{},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	greet_service := application.NewService(&service.GreetService{})
	fs_service := application.NewServiceWithOptions(&service.FileService{
		App: app,
	}, application.ServiceOptions{
		Route: "/file",
	})
	common_service := application.NewService(&service.CommonService{
		App: app,
		Biz: biz,
	})
	paste_service := application.NewService(&service.PasteService{
		App: app,
		Biz: biz,
	})
	system_service := application.NewService(&service.SystemService{})
	sync_service := application.NewService(&service.SyncService{
		App: app,
		Biz: biz,
	})
	app.RegisterService(greet_service)
	app.RegisterService(fs_service)
	app.RegisterService(common_service)
	app.RegisterService(paste_service)
	app.RegisterService(system_service)
	app.RegisterService(sync_service)
	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:               "Tool",
		MaximiseButtonState: application.ButtonHidden,
		MinimiseButtonState: application.ButtonHidden,
		DisableResize:       true,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			// TitleBar:                application.MacTitleBarHiddenInset,
		},
		Width:            450,
		Height:           680,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	error_win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Error",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
		},
		Hidden:             true,
		Width:              428,
		Height:             260,
		DisableResize:      true,
		ZoomControlEnabled: false,
		BackgroundColour:   application.NewRGB(27, 38, 54),
		URL:                "/error",
	})
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
		var created_paste_event models.PasteEvent
		// var prev_paste_event models.PasteEvent
		// if err := biz_app.DB.First(&prev_paste_event).Error; err != nil {
		// }
		for data := range ch {
			fmt.Println(data.Type)
			now := time.Now()
			if data.Type == "public.file-url" {
				if files, ok := data.Data.([]string); ok {
					for _, f := range files {
						fmt.Println(f)
					}
				}
			}
			if data.Type == "public.utf8-plain-text" {
				if text, ok := data.Data.(string); ok {
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
					// created_paste_event.Content = created_paste_content
					if err := biz.DB.Create(&created_paste_event).Error; err != nil {
						log.Fatalf("Failed to create paste event: %v", err)
						return
					}
				}
			}
			if data.Type == "public.png" {
				if f, ok := data.Data.([]byte); ok {
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
					if err := biz.DB.Create(&created_paste_event).Error; err != nil {
						log.Fatalf("Failed to create paste event: %v", err)
						return
					}
				}
			}
			app.Event.Emit("clipboard:update", created_paste_event)
		}
	}()
	app.Event.On("m:show-error", func(event *application.CustomEvent) {
		body := event.Data.(service.ErrorBody)
		url := fmt.Sprintf("/error?title=%v&desc=%v", body.Title, body.Content)
		error_win.SetURL(url)
		error_win.Show()
	})
	win.OnWindowEvent(events.Common.WindowFilesDropped, func(e *application.WindowEvent) {
		fmt.Println(e.Context().DroppedFiles())
	})
	go func() {
		cfg, err := config.LoadConfig()
		if err != nil {
			t := fmt.Sprintf("Failed to load config: %v", err)
			error_win.SetURL("/error?title=InitializeFailed&desc=" + t)
			error_win.Show()
			return
		}
		logger := logger.NewLogger(cfg.LogLevel)
		defer logger.Sync()
		database, err := db.NewDatabase(cfg)
		if err != nil {
			t := fmt.Sprintf("Failed to connect to database, %v", err)
			fmt.Println(t)
			error_win.SetURL("/error?title=InitializeFailed&desc=" + t)
			error_win.Show()
			return
		}
		migrator := db.NewMigrator(cfg, logger, &migrations)
		if err := migrator.MigrateUp(); err != nil {
			t := fmt.Sprintf("Failed to run migrations, %v", err)
			fmt.Println(t)
			error_win.SetURL("/error?title=InitializeFailed&desc=" + t)
			error_win.Show()
			return
		}
		biz.Set(database, cfg)
		win.Show()
	}()

	// Run the application. This blocks until the application has been exited.
	err := app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}
