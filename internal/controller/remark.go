package controller

import (
	"devboard/models"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type PasteEventRemarkController struct {
	db         *gorm.DB
	machine_id string
}

func NewRemarkController(db *gorm.DB) *PasteEventRemarkController {
	return &PasteEventRemarkController{
		db: db,
	}
}

type RemarkCreateBody struct {
	Content      string `json:"content"`
	PasteEventId string `json:"paste_event_id"`
}

func (s *PasteEventRemarkController) CreateRemark(body RemarkCreateBody) (*models.Remark, error) {
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			return
		}
	}()
	// now_timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	created := models.Remark{
		Content:      body.Content,
		PasteEventId: body.PasteEventId,
	}
	if err := tx.Create(&created).Error; err != nil {
		return nil, err
	}
	// if err := tx.Model(&models.PasteEvent{}).Where("id = ?", body.PasteEventId).Update("sync_status", 1).Error; err != nil {
	// 	return Error(err)
	// }
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return &created, nil
}

type RemarkListBody struct {
	models.Pagination

	PasteEventId string `json:"paste_event_id"`
	Keyword      string `json:"keyword"`
}

func (s *PasteEventRemarkController) FetchRemarkList(body RemarkListBody) (*ListResp[models.Remark], error) {
	query := s.db.Model(&models.Remark{})
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
		return nil, err
	}
	list2, has_more, next_marker := pb.ProcessResults(list1)
	return &ListResp[models.Remark]{
		List:       list2,
		Page:       body.Page,
		PageSize:   pb.GetLimit(),
		HasMore:    has_more,
		NextMarker: next_marker,
	}, nil
}

type RemarkDeleteBody struct {
	Id string `json:"id"`
}

func (s *PasteEventRemarkController) DeleteRemark(body RemarkDeleteBody) (*models.Remark, error) {
	if body.Id == "" {
		return nil, fmt.Errorf("Missing the id")
	}
	var existing models.Remark
	if err := s.db.Where("id = ?", body.Id).First(&existing).Error; err != nil {
		return nil, err
	}
	existing.DeletedAt = gorm.DeletedAt{Time: time.Now(), Valid: true}
	if err := s.db.Save(&existing).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}
