package controller

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/ltaoo/clipboard-go"
	"gorm.io/gorm"

	"devboard/models"
)

type PasteController struct {
	db         *gorm.DB
	machine_id string
}

func NewPasteController(db *gorm.DB, machine_id string) *PasteController {
	return &PasteController{
		db:         db,
		machine_id: machine_id,
	}
}

type PasteListBody struct {
	models.Pagination

	Types   []string `json:"types"`
	Keyword string   `json:"keyword"`
}
type PasteCategoryResp struct {
	Id    string `json:"id"`
	Label string `json:"label"`
}
type PasteListItemResp struct {
	Id           string              `json:"id"`
	ContentType  string              `json:"content_type"`
	Text         string              `json:"text,omitempty"`
	HTML         string              `json:"html,omitempty"`
	ImageBase64  string              `json:"image_base64,omitempty"`
	FileListJSON string              `json:"file_list_json,omitempty"`
	Details      string              `json:"details,omitempty"`
	CreatedAt    string              `json:"created_at"`
	Categories   []PasteCategoryResp `json:"categories"`
}

func (s *PasteController) FetchPasteEventList(body PasteListBody) (*ListResp[PasteListItemResp], error) {
	query := s.db.Model(&models.PasteEvent{})
	if body.Keyword != "" {
		query = query.Where("paste_event.text LIKE ?", "%"+body.Keyword+"%")
	}
	if len(body.Types) != 0 {
		query = query.Joins("JOIN paste_event_category_mapping ON paste_event_category_mapping.paste_event_id = paste_event.id").Where("paste_event_category_mapping.category_id IN ?", body.Types).Distinct("paste_event.*")
	}
	pb := models.NewPaginationBuilder[models.PasteEvent](query).
		SetLimit(body.PageSize).
		SetPage(body.Page).
		SetOrderBy("paste_event.created_at DESC")
	var list1 []models.PasteEvent
	if err := pb.Build().Preload("Categories").Find(&list1).Error; err != nil {
		return nil, err
	}
	list2, has_more, next_marker := pb.ProcessResults(list1)
	var list []PasteListItemResp
	for _, v := range list2 {
		vv := PasteListItemResp{
			Id:           v.Id,
			ContentType:  v.ContentType,
			Text:         v.Text,
			HTML:         v.Html,
			ImageBase64:  v.ImageBase64,
			FileListJSON: v.FileListJSON,
			Details:      v.Details,
			CreatedAt:    v.CreatedAt,
		}
		var categories []PasteCategoryResp
		for _, c := range v.Categories {
			categories = append(categories, PasteCategoryResp{
				Id:    c.Id,
				Label: c.Label,
			})
		}
		vv.Categories = categories
		list = append(list, vv)
	}
	return &ListResp[PasteListItemResp]{
		List:       list,
		Page:       body.Page,
		PageSize:   pb.GetLimit(),
		HasMore:    has_more,
		NextMarker: next_marker,
	}, nil
}

type PasteProfileBody struct {
	EventId string `json:"event_id"`
}

func (s *PasteController) FetchPasteEventProfile(body PasteProfileBody) (*models.PasteEvent, error) {
	if body.EventId == "" {
		return nil, fmt.Errorf("缺少 id 参数")
	}
	var record models.PasteEvent
	if err := s.db.Where("id = ?", body.EventId).
		Preload("App").
		Preload("Device").
		// 	Preload("Remarks", func(db *gorm.DB) *gorm.DB {
		// 	return db.Order("remark.created_at DESC")
		// }).
		Preload("Categories").First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

type PasteEventBody struct {
	PasteEventId string `json:"paste_event_id"`
}

func (s *PasteController) DeletePasteEvent(body PasteEventBody) (*models.PasteEvent, error) {
	if body.PasteEventId == "" {
		return nil, fmt.Errorf("缺少 id 参数")
	}
	var existing models.PasteEvent
	if err := s.db.Where("id = ?", body.PasteEventId).First(&existing).Error; err != nil {
		return nil, err
	}
	existing.DeletedAt = gorm.DeletedAt{Time: time.Now(), Valid: true}
	if err := s.db.Save(&existing).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}

type PasteWriteBody struct {
	EventId string `json:"event_id"`
}

func (s *PasteController) WritePasteContent(body PasteWriteBody) (int, error) {
	if body.EventId == "" {
		return 0, fmt.Errorf("缺少 id 参数")
	}
	var record models.PasteEvent
	if err := s.db.Where("id = ?", body.EventId).First(&record).Error; err != nil {
		return 0, err
	}
	is_text := record.ContentType == "text"
	is_html := record.ContentType == "html"
	is_image := record.ContentType == "image"
	is_file := record.ContentType == "file"

	if record.Html != "" {
		is_html = true
	}
	if record.ImageBase64 != "" {
		is_image = true
	}
	if record.FileListJSON != "" {
		is_file = true
	}
	if is_html {
		text := record.Html
		if text == "" {
			text = record.Text
		}
		if err := clipboard.WriteHTML(text, record.Text); err != nil {
			return 0, err
		}
		return 1, nil
	}
	if is_image {
		decoded_data, err := base64.StdEncoding.DecodeString(record.ImageBase64)
		if err != nil {
			return 0, err
		}
		if err := clipboard.WriteImage(decoded_data); err != nil {
			return 0, err
		}
		return 1, nil
	}
	if is_file {
		var files []FileInPasteEvent
		if err := json.Unmarshal([]byte(record.FileListJSON), &files); err != nil {
			return 0, err
		}
		var errors []string
		var file_paths []string
		for _, f := range files {
			_, err := os.Stat(f.AbsolutePath)
			if err != nil {
				errors = append(errors, err.Error())
				continue
			}
			file_paths = append(file_paths, f.AbsolutePath)
		}
		if len(file_paths) == 0 {
			return 0, fmt.Errorf("There's no valid file can copy.")
		}
		if err := clipboard.WriteFiles(file_paths); err != nil {
			return 0, err
		}
		return 1, nil
	}
	if is_text {
		if err := clipboard.WriteText(record.Text); err != nil {
			return 0, err
		}
		return 1, nil
	}
	return 0, fmt.Errorf("invalid record data")
}
