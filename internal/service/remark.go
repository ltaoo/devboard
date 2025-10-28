package service

import (
	"fmt"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

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

type RemarkListBody struct {
	models.Pagination

	PasteEventId string `json:"paste_event_id"`
	Keyword      string `json:"keyword"`
}

func (s *RemarkService) FetchRemarkList(body RemarkListBody) *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	query := s.Biz.DB.Model(&models.Remark{})
	if body.Keyword != "" {
		query = query.Where("remark.content LIKE ?", "%"+body.Keyword+"%")
	}
	if body.PasteEventId != "" {
		query = query.Where("remark.paste_event_id = ?", body.PasteEventId)
	}
	pb := models.NewPaginationBuilder[models.Remark](query).
		SetLimit(body.PageSize).
		SetPage(body.Page).
		SetOrderBy("remark.created_at DESC")
	var list1 []models.Remark
	if err := pb.Build().Find(&list1).Error; err != nil {
		return Error(err)
	}
	list2, has_more, next_marker := pb.ProcessResults(list1)
	return Ok(map[string]interface{}{
		"list":        list2,
		"page":        body.Page,
		"page_size":   pb.GetLimit(),
		"has_more":    has_more,
		"next_marker": next_marker,
	})
}

type DeleteRemarkBody struct {
	Id string `json:"id"`
}

func (s *RemarkService) DeleteRemark(body DeleteRemarkBody) *Result {
	if body.Id == "" {
		return Error(fmt.Errorf("Missing the id"))
	}
	var existing models.Remark
	if err := s.Biz.DB.Where("id = ?", body.Id).First(&existing).Error; err != nil {
		return Error(err)
	}
	existing.DeletedAt = gorm.DeletedAt{Time: time.Now(), Valid: true}
	if err := s.Biz.DB.Save(&existing).Error; err != nil {
		return Error(err)
	}
	return Ok(nil)
}
