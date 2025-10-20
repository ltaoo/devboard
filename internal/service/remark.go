package service

import (
	"devboard/internal/biz"
	"devboard/models"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
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
	remark := models.Remark{
		Id:                uuid.New().String(),
		Content:           body.Content,
		PasteEventId:      body.PasteEventId,
		LastOperationTime: strconv.FormatInt(time.Now().UnixMilli(), 10),
		LastOperationType: 1,
	}
	if err := s.Biz.DB.Create(&remark).Error; err != nil {
		return Error(err)
	}
	return Ok(nil)
}
