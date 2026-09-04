package service

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/ltaoo/velo"
	velo_file "github.com/ltaoo/velo/file"
)

type FileService struct {
	App   *velo.Box
	route string
}

func NewFileService(app *velo.Box) *FileService {
	return &FileService{App: app, route: "/file"}
}

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

func get_video_dimensions(filename string) (width, height int, err error) {
	return 0, 0, nil
}

func (f *FileService) OpenFileDialog() *Result {
	paths, err := velo_file.ShowOpenDialog(velo_file.OpenDialogOptions{
		Title:                   "Select files",
		CanChooseFiles:          true,
		AllowsMultipleSelection: true,
	})
	if err == nil {
		var files []FileResp
		var error_messages []string

		for _, file_path := range paths {
			info, err := os.Stat(file_path)
			if err != nil {

				error_messages = append(error_messages, fmt.Sprintf("Error getting file info: %v\n", err))
				continue
			}

			if info.IsDir() {
				error_messages = append(error_messages, fmt.Sprintf("'%s' is a directory, ignoring.\n", file_path))
				continue
			}

			size := info.Size()
			fmt.Printf("File: %s\nSize: %d bytes\n", file_path, size)

			// 获取 MIME 类型
			file, err := os.Open(file_path)
			if err != nil {
				error_messages = append(error_messages, fmt.Sprintf("Error opening file: %v\n", err))
				continue
			}
			defer file.Close()

			buffer := make([]byte, 512)
			read_count, err := file.Read(buffer)
			if err != nil && !errors.Is(err, io.EOF) {
				error_messages = append(error_messages, fmt.Sprintf("Error reading file for MIME detection: %v\n", err))
				continue
			}
			mine_type := http.DetectContentType(buffer[:read_count])
			// 尝试从文件扩展名获取更具体的 MIME 类型
			ext := filepath.Ext(file_path)
			if ext != "" {
				if ext := mime.TypeByExtension(ext); ext != "" {
					mine_type = ext
				}
			}
			ff := FileResp{
				Name:      info.Name(),
				FullPath:  file_path,
				Size:      size,
				MimeType:  mine_type,
				CreatedAt: info.ModTime().Unix(),
			}
			if ff.MimeType == "video/mp4" {
				w, h, err := get_video_dimensions(file_path)
				if err == nil {
					ff.Width = w
					ff.Height = h
				}
			}
			files = append(files, ff)
		}
		return Ok(map[string]interface{}{
			"files":  files,
			"errors": error_messages,
		})
	}
	if err != nil && !errors.Is(err, velo_file.ErrCancelled) {
		return Error(err)
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
	path, err := velo_file.ShowSaveDialog(velo_file.SaveDialogOptions{DefaultFilename: body.Filename})
	if err != nil {
		if errors.Is(err, velo_file.ErrCancelled) {
			return Ok(map[string]interface{}{"cancel": true})
		}
		return Error(err)
	}
	file, err := os.Create(path)
	if err != nil {
		return Error(err)
	}
	defer file.Close()
	_, err = file.Write([]byte(body.Content))
	if err != nil {
		return Error(err)
	}
	return Ok(map[string]interface{}{})
}

type OpenFolderAndHighlightFileBody struct {
	FilePath string `json:"file_path"`
}

func (s *FileService) OpenFolderAndHighlightFile(body OpenFolderAndHighlightFileBody) *Result {
	if body.FilePath == "" {
		return Error(fmt.Errorf("Missing the `file_path`"))
	}
	file_path := body.FilePath

	_, err := os.Stat(file_path)
	if err != nil {
		return Error(err)
	}

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", "/select,", file_path)
	case "darwin":
		cmd = exec.Command("open", "-R", file_path)
	case "linux":
		cmd = exec.Command("xdg-open", file_path)
	default:
		return Error(fmt.Errorf("Unsupported operating system"))
	}
	err = cmd.Start()
	if err != nil {
		return Error(err)
	}
	return Ok("Success")
}

type OpenPreviewWindowBody struct {
	MimeType string `json:"mime_type"`
	Filepath string `json:"filepath"`
}

func (s *FileService) OpenPreviewWindow(body OpenPreviewWindowBody) *Result {
	title := ""
	pathname := ""
	switch body.MimeType {
	case "video/mp4":
		title, pathname = "视频预览", "/video_preview"
	case "image/jpeg", "image/png":
		title, pathname = "图片预览", "/image_preview"
	case "application/pdf":
		title, pathname = "PDF 预览", "/pdf_preview"
	}
	if pathname == "" {
		return Error(fmt.Errorf("该文件不支持预览"))
	}
	s.App.OpenWindow(&velo.VeloWebviewOpt{
		Name:                   pathname,
		Title:                  title,
		Width:                  420,
		Height:                 720,
		BackgroundColor:        velo.NewRGB(27, 38, 54),
		MacBackdropTranslucent: true,
		MacTitleBarHeight:      50,
		MacTitleBarInset:       true,
		Pathname:               pathname + "?f=" + url.QueryEscape(body.Filepath),
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
