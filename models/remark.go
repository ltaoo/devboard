package models

import (
	"time"

	"gorm.io/gorm"
)

type Remark struct {
	Id                string         `json:"id"`
	Content           string         `json:"content"`
	PasteEventId      string         `json:"paste_event_id"`
	LastOperationTime string         `json:"last_operation_time"`
	LastOperationType int            `json:"last_operation_type"`
	CreatedAt         time.Time      `json:"created_at"`
	DeletedAt         gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

func (Remark) TableName() string {
	return "remark"
}
