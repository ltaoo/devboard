package controller

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"

	"devboard/internal/transformer"
	"devboard/models"
	_html "devboard/pkg/html"
	"devboard/pkg/util"
)

type PasteExtraInfo struct {
	AppName     string
	AppFullPath string
	WindowTitle string
	PlainText   string
	MachineId   string
}

var unknown_app_id = ""

func get_unknown_app_id(db *gorm.DB) string {
	if unknown_app_id != "" {
		return unknown_app_id
	}
	var existing []models.Device
	if err := db.Where("name = Unknown").Limit(1).Find(&existing).Error; err != nil {
		return ""
	}
	if len(existing) == 0 {
		return ""
	}
	unknown_app_id = existing[0].Id
	return unknown_app_id
}
func app_name_to_id(name string) string {
	// 转换为小写
	result := strings.ToLower(name)

	// 使用 strings.Fields 分割所有空白字符，然后用下划线连接
	words := strings.Fields(result)
	result = strings.Join(words, "_")

	return result
}
func get_app_id(db *gorm.DB, title string) string {
	var existing []models.App
	if err := db.Where("name = ?", title).Limit(1).Find(&existing).Error; err != nil {
		return get_unknown_app_id(db)
	}
	if len(existing) == 0 {
		created := &models.App{
			Name:     title,
			UniqueId: title,
			LogoURL:  "",
			BaseModel: models.BaseModel{
				Id: app_name_to_id(title),
			},
		}
		if err := db.Create(&created).Error; err != nil {
			return get_unknown_app_id(db)
		}
		return created.Id
	}
	app := existing[0]
	return app.Id
}

var device_id = ""

func get_device_id(db *gorm.DB, machine_id string) string {
	if device_id != "" {
		return device_id
	}
	var existing []models.Device
	if err := db.Where("mac_address = ?", machine_id).Limit(1).Find(&existing).Error; err != nil {
		return ""
	}
	if len(existing) == 0 {
		return ""
	}
	device_id = existing[0].Id
	return device_id
}

func (s *PasteController) HandlePasteText(text string, extra *PasteExtraInfo) (*models.PasteEvent, error) {
    var created_paste_event models.PasteEvent
    var existing []models.PasteEvent
    if err := s.db.Where("content_type = ? AND text = ?", "text", text).Limit(1).Find(&existing).Error; err == nil && len(existing) > 0 {
        tx := s.db.Begin()
        defer func() {
            if r := recover(); r != nil {
                tx.Rollback()
                return
            }
        }()
        if err := tx.Save(&existing[0]).Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        if err := tx.Commit().Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        return nil, nil
    }
	// now := time.Now()
	// now_timestamp := strconv.FormatInt(now.UnixMilli(), 10)
	created_paste_event = models.PasteEvent{
		ContentType: "text",
		Text:        text,
		AppId:       get_app_id(s.db, extra.AppName),
		DeviceId:    get_device_id(s.db, extra.MachineId),
	}
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := transformer.TextContentDetector(text)
	categories = append(categories, "text")
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created_paste_event, nil
}

func (s *PasteController) HandlePasteHTML(html_content string, extra *PasteExtraInfo) (*models.PasteEvent, error) {
    var created_paste_event models.PasteEvent
    r := _html.ParseHTMLContent(html_content)
    text := extra.PlainText
    html := r.HTMLContent
    html = _html.CleanRichTextStrict(html)
    var existing []models.PasteEvent
    if err := s.db.Where("content_type = ? AND html = ?", "html", html).Limit(1).Find(&existing).Error; err == nil && len(existing) > 0 {
        tx := s.db.Begin()
        defer func() {
            if r := recover(); r != nil {
                tx.Rollback()
                return
            }
        }()
        if err := tx.Save(&existing[0]).Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        if err := tx.Commit().Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        return nil, nil
    }
	details, _ := json.Marshal(&map[string]interface{}{
		"source_url":   r.SourceURL,
		"window_title": extra.WindowTitle,
	})
	created_paste_event = models.PasteEvent{
		ContentType: "html",
		Text:        text,
		Html:        html,
		Details:     string(details),
		AppId:       get_app_id(s.db, extra.AppName),
		DeviceId:    get_device_id(s.db, extra.MachineId),
	}
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := []string{"html"}
	if text != "" {
		extra_categories := transformer.TextContentDetector(text)
		categories = append(categories, extra_categories...)
	}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created_paste_event, nil
}

type PNGFileInfo struct {
	Width         int    `json:"width"`
	Height        int    `json:"height"`
	Size          int    `json:"size"`
	SizeForHumans string `json:"size_for_humans"`
}

func (s *PasteController) HandlePastePNG(image_bytes []byte, extra *PasteExtraInfo) (*models.PasteEvent, error) {
	// now := time.Now()
	// now_timestamp := strconv.FormatInt(now.UnixMilli(), 10)
    encoded := base64.StdEncoding.EncodeToString(image_bytes)
    var existing []models.PasteEvent
    if err := s.db.Where("content_type = ? AND image_base64 = ?", "image", encoded).Limit(1).Find(&existing).Error; err == nil && len(existing) > 0 {
        tx := s.db.Begin()
        defer func() {
            if r := recover(); r != nil {
                tx.Rollback()
                return
            }
        }()
        if err := tx.Save(&existing[0]).Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        if err := tx.Commit().Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        return nil, nil
    }
	details := "{}"
	reader := bytes.NewReader(image_bytes)
	info, err := png.DecodeConfig(reader)
	if err == nil {
		t, err := json.Marshal(&map[string]interface{}{
			"width":           info.Width,
			"height":          info.Height,
			"size":            len(image_bytes),
			"size_for_humans": util.AutoByteSize(int64(len(image_bytes))),
			"window_title":    extra.WindowTitle,
		})
		if err == nil {
			details = string(t)
		}
	}
	created_paste_event := models.PasteEvent{
		ContentType: "image",
		ImageBase64: encoded,
		Details:     details,
		AppId:       get_app_id(s.db, extra.AppName),
		DeviceId:    get_device_id(s.db, extra.MachineId),
	}
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := []string{"image"}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
			// LastOperationTime: now_timestamp,
			// LastOperationType: 1,
			// CreatedAt:         now_timestamp,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created_paste_event, nil
}

type FileInPasteEvent struct {
	Name         string `json:"name"`
	AbsolutePath string `json:"absolute_path"`
	MimeType     string `json:"mime_type"`
}

func (s *PasteController) HandlePasteFile(files []string, extra *PasteExtraInfo) (*models.PasteEvent, error) {
    var created_paste_event models.PasteEvent
	// now := time.Now()
	// now_timestamp := strconv.FormatInt(now.UnixMilli(), 10)
	var results []FileInPasteEvent
	for _, f := range files {
		info, err := os.Stat(f)
		if err != nil {
			continue
		}
		name := info.Name()
		if info.IsDir() {
			results = append(results, FileInPasteEvent{
				Name:         name,
				AbsolutePath: f,
				MimeType:     "folder",
			})
			continue
		}
		mime_type := mime.TypeByExtension(filepath.Ext(name))
		if mime_type == "" {
			// 如果无法通过扩展名确定，使用 application/octet-stream 作为默认值
			mime_type = "application/octet-stream"
		} else {
			// 去除可能的参数（如 charset=utf-8）
			mime_type = strings.Split(mime_type, ";")[0]
		}
		results = append(results, FileInPasteEvent{
			Name:         name,
			AbsolutePath: f,
			MimeType:     mime_type,
		})
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("No valid file")
	}
    content, err := json.Marshal(&results)
    if err != nil {
        return nil, err
    }
    var existing []models.PasteEvent
    if err := s.db.Where("content_type = ? AND file_list_json = ?", "file", string(content)).Limit(1).Find(&existing).Error; err == nil && len(existing) > 0 {
        tx := s.db.Begin()
        defer func() {
            if r := recover(); r != nil {
                tx.Rollback()
                return
            }
        }()
        if err := tx.Save(&existing[0]).Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        if err := tx.Commit().Error; err != nil {
            tx.Rollback()
            return nil, err
        }
        return nil, nil
    }
	details, _ := json.Marshal(&map[string]interface{}{
		"window_title": extra.WindowTitle,
	})
	created_paste_event = models.PasteEvent{
		ContentType:  "file",
		FileListJSON: string(content),
		Details:      string(details),
		AppId:        get_app_id(s.db, extra.AppName),
		DeviceId:     get_device_id(s.db, extra.MachineId),
	}
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	if err := tx.Create(&created_paste_event).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	var errors []error
	categories := []string{"file"}
	for _, c := range categories {
		created_paste_event.Categories = append(created_paste_event.Categories, models.CategoryNode{
			BaseModel: models.BaseModel{
				Id: c,
			},
			Label: c,
		})
		created_map := models.PasteEventCategoryMapping{
			PasteEventId: created_paste_event.Id,
			CategoryId:   c,
			// LastOperationTime: now_timestamp,
			// LastOperationType: 1,
			// CreatedAt:         now_timestamp,
		}
		if err := tx.Create(&created_map).Error; err != nil {
			tx.Rollback()
			errors = append(errors, err)
		}
	}
	if len(errors) != 0 {
		return nil, errors[0]
	}
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created_paste_event, nil
}
