package service

import (
	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/internal/biz"
	"devboard/models"
)

type RemarkService struct {
	App *application.App
	Biz *biz.BizApp
}

type CreateRemarkBody struct {
	Content      string `json:"content"`
	PasteEventId string `json:"paste_event_id"`
}

func (s *RemarkService) CreateRemark(body CreateRemarkBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	tx := s.Biz.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	// now_timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	created_at := models.Remark{
		Content:      body.Content,
		PasteEventId: body.PasteEventId,
	}
	if err := tx.Create(&created_at).Error; err != nil {
		return Error(err)
	}
	// if err := tx.Model(&models.PasteEvent{}).Where("id = ?", body.PasteEventId).Update("sync_status", 1).Error; err != nil {
	// 	return Error(err)
	// }
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return Error(err)
	}
	return Ok(nil)
}
