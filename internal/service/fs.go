package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/pkg/lodash"
)

type FileResp struct {
	Name      string `json:"name"`
	FullPath  string `json:"full_path"`
	MimeType  string `json:"mine_type"`
	Size      int64  `json:"size"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Duration  int    `json:"duration"`
	CreatedAt int64  `json:"created_at"`
}

type FileService struct {
	App   *application.App
	route string
}

func (s *FileService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	s.route = options.Route
	return nil
}

func get_video_dimensions(filename string) (width, height int, err error) {
	return 0, 0, nil
}

func (f *FileService) OpenFileDialog() *Result {
	dialog := application.OpenFileDialog()
	dialog.SetTitle("Select Image")
	dialog.SetOptions(&application.OpenFileDialogOptions{
		CanChooseFiles:       true,
		CanCreateDirectories: true,
		CanChooseDirectories: true,
		// Filters: []application.FileFilter{
		// 	{
		// 		// DisplayName: "Images (*.png;*.jpg)",
		// 		Pattern: "*.png",
		// 	},
		// },
	})
	if paths, err := dialog.PromptForMultipleSelection(); err == nil {
		var files []FileResp
		var errors []string

		for _, f := range paths {
			info, err := os.Stat(f)
			if err != nil {

				errors = append(errors, fmt.Sprintf("Error getting file info: %v\n", err))
				continue
			}

			if info.IsDir() {
				errors = append(errors, fmt.Sprintf("'%s' is a directory, ignoring.\n", f))
				continue
			}

			size := info.Size()
			fmt.Printf("File: %s\nSize: %d bytes\n", f, size)

			// 获取 MIME 类型
			file, err := os.Open(f)
			if err != nil {
				errors = append(errors, fmt.Sprintf("Error opening file: %v\n", err))
				continue
			}
			defer file.Close()

			buffer := make([]byte, 512)
			_, err = file.Read(buffer)
			if err != nil {
				errors = append(errors, fmt.Sprintf("Error reading file for MIME detection: %v\n", err))
				continue
			}
			mine_type := http.DetectContentType(buffer)
			// 尝试从文件扩展名获取更具体的 MIME 类型
			ext := filepath.Ext(f)
			if ext != "" {
				if ext := mime.TypeByExtension(ext); ext != "" {
					mine_type = ext
				}
			}
			ff := FileResp{
				Name:      info.Name(),
				FullPath:  f,
				Size:      size,
				MimeType:  mine_type,
				CreatedAt: info.ModTime().Unix(),
			}
			if ff.MimeType == "video/mp4" {
				w, h, err := get_video_dimensions(f)
				if err == nil {
					ff.Width = w
					ff.Height = h
				}
			}
			files = append(files, ff)
		}
		return Ok(map[string]interface{}{
			"files":  files,
			"errors": errors,
		})
	}
	return Ok(map[string]interface{}{
		"files":  []interface{}{},
		"errors": []interface{}{},
		"cancel": true,
	})
}

type SaveFileToBody struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
}

func (f *FileService) SaveFileTo(body SaveFileToBody) *Result {
	if body.Filename == "" {
		return Error(fmt.Errorf("缺少 filename 参数"))
	}
	if body.Content == "" {
		return Error(fmt.Errorf("缺少 content 参数"))
	}
	dialog := application.SaveFileDialog()
	dialog.CanCreateDirectories(true)
	dialog.SetFilename(body.Filename)
	// dialog.SetTitle("Save Document")
	// dialog.SetDefaultFilename("document.txt")
	// dialog.SetFilters([]*application.FileFilter{
	// 	{
	// 		DisplayName: "Text Files (*.txt)",
	// 		Pattern:     "*.txt",
	// 	},
	// })

	if path, err := dialog.PromptForSingleSelection(); err == nil {
		file, err := os.Create(path)
		if err != nil {
			return Error(err)
		}
		defer file.Close()
		_, err = file.Write([]byte(body.Content))
		if err != nil {
			return Error(err)
		}
	}
	return Ok(map[string]interface{}{})
}

type OpenPreviewWindowBody struct {
	MimeType string `json:"mime_type"`
	Filepath string `json:"filepath"`
}

func (s *FileService) OpenPreviewWindow(body OpenPreviewWindowBody) *Result {
	type FilePreviewPayload struct {
		Title string
		URL   string
	}
	p := FilePreviewPayload{
		Title: "",
		URL:   "",
	}
	if lodash.Include([]string{"video/mp4"}, func(v string, i int) bool {
		return v == body.MimeType
	}) {
		p.Title = "视频预览"
		p.URL = "/video_preview"
	} else if lodash.Include([]string{"image/jpeg", "image/png"}, func(v string, i int) bool {
		return v == body.MimeType
	}) {
		p.Title = "图片预览"
		p.URL = "/image_preview"
	}
	if p.URL == "" {
		return Error(fmt.Errorf("该文件不支持预览"))
	}
	s.App.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: p.Title,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Width:            420,
		Height:           720,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              p.URL + "?f=" + url.QueryEscape(body.Filepath),
	})
	return Ok(map[string]interface{}{})
}

func (s *FileService) URL(text string) (string, error) {
	if s.route == "" {
		return "", errors.New("http handler unavailable")
	}
	return fmt.Sprintf("%s?f=%s", s.route, url.QueryEscape(text)), nil
}

func (s *FileService) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Extract the f parameter from the request
	f := r.URL.Query().Get("f")
	if f == "" {
		fmt.Println(1)
		http.Error(w, "Missing 'f' parameter", http.StatusBadRequest)
		return
	}
	// 安全检查：防止目录遍历攻击
	clean_filepath := filepath.Clean(f)
	if clean_filepath == ".." || len(clean_filepath) >= 2 && clean_filepath[:2] == ".." {
		fmt.Println(2)
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	// 打开文件
	file, err := os.Open(clean_filepath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, "Error opening file", http.StatusInternalServerError)
		}
		return
	}
	defer file.Close()
	// 获取文件信息
	file_info, err := file.Stat()
	if err != nil {
		http.Error(w, "Error getting file info", http.StatusInternalServerError)
		return
	}
	// 检查是否是目录
	if file_info.IsDir() {
		http.Error(w, "Path is a directory", http.StatusBadRequest)
		return
	}
	// 根据文件扩展名设置 Content-Type
	content_type := mime.TypeByExtension(filepath.Ext(clean_filepath))
	if content_type == "" {
		// 如果无法确定类型，使用 octet-stream 作为默认值
		content_type = "application/octet-stream"
	}
	// 设置响应头
	w.Header().Set("Content-Type", content_type)
	w.Header().Set("Content-Length", fmt.Sprint(file_info.Size()))
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filepath.Base(clean_filepath)))

	// 将文件内容写入响应
	_, err = io.Copy(w, file)
	if err != nil {
		http.Error(w, "Error writing response", http.StatusInternalServerError)
		return
	}
}
