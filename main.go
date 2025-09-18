package main

import (
	"context"
	"embed"
	_ "embed"
	"fmt"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"gorm.io/gorm"

	"devboard/config"
	"devboard/db"
	"devboard/internal/service"
	"devboard/models"
	"devboard/pkg/clipboard"
	"devboard/pkg/logger"
	"devboard/pkg/util"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

//go:embed all:migrations
var migrations embed.FS

type BizApplication struct {
	DB *gorm.DB
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	// var database *gorm.DB
	biz_app := BizApplication{}

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
	v := service.NewPasteService(app, biz_app.DB)
	paste_service := application.NewService(&v)
	app.RegisterService(greet_service)
	app.RegisterService(fs_service)
	app.RegisterService(paste_service)

	error_win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Error",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			// TitleBar:                application.MacTitleBarHiddenInset,
		},
		Hidden:             true,
		Width:              428,
		Height:             260,
		DisableResize:      true,
		ZoomControlEnabled: false,
		BackgroundColour:   application.NewRGB(27, 38, 54),
		URL:                "/error",
	})

	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Tool",
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
	win.OnWindowEvent(events.Common.WindowFilesDropped, func(e *application.WindowEvent) {
		fmt.Println(e.Context().DroppedFiles())
	})

	// Create a goroutine that emits an event containing the current time every second.
	// The frontend can listen to this event and update the UI accordingly.
	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			app.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()
	go func() {
		ch := clipboard.Watch(context.TODO())
		for data := range ch {
			fmt.Println(data.Type)
			if data.Type == "public.file-url" {
				if files, ok := data.Data.([]string); ok {
					for _, f := range files {
						fmt.Println(f)
					}
				}
			}
			if data.Type == "public.utf8-plain-text" {
				if text, ok := data.Data.(string); ok {
					fmt.Println(text)
					created_paste_content := models.PasteContent{
						ContentType: "text",
						Text:        text,
					}
					if err := biz_app.DB.Create(&created_paste_content).Error; err != nil {
						log.Fatalf("Failed to create paste content: %v", err)
						return
					}
					created_paste_event := models.PasteEvent{
						ContentType: "text",
						ContentId:   created_paste_content.Id,
					}
					if err := biz_app.DB.Create(&created_paste_event).Error; err != nil {
						log.Fatalf("Failed to create paste event: %v", err)
						return
					}
				}
			}
			if data.Type == "public.png" {
				if f, ok := data.Data.([]byte); ok {
					img_filepath, err := util.SaveByteAsLocalImage(f)
					if err == nil {
						fmt.Println("the image save to", img_filepath)
					}
				}
			}
		}
	}()
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
		biz_app.DB = database
		v.SetDatabase(database)
		win.Show()
	}()

	// Run the application. This blocks until the application has been exited.
	err := app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}
