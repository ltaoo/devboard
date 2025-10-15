package models

import (
	"time"

	"gorm.io/gorm"
)

type PasteEvent struct {
	Id                string         `json:"id"`
	ContentType       string         `json:"content_type"`
	Text              string         `json:"text"`
	Html              string         `json:"html"`
	FileListJSON      string         `json:"file_list_json"`
	ImageBase64       string         `json:"image_base64"`
	Other             string         `json:"other"`
	Details           string         `json:"details"`
	LastOperationTime string         `json:"last_operation_time"`
	LastOperationType int            `json:"last_operation_type"`
	CreatedAt         time.Time      `json:"created_at"`
	DeletedAt         gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	Categories []CategoryNode `json:"categories" gorm:"many2many:paste_event_category_mapping;joinForeignKey:paste_event_id;JoinReferences:category_id"`
}

func (PasteEvent) TableName() string {
	return "paste_event"
}

// type PasteContent struct {
// 	Id          int            `json:"id"`
// 	ContentType string         `json:"content_type"`

// 	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
// 	CreatedAt   time.Time      `json:"created_at"`
// }

// func (PasteContent) TableName() string {
// 	return "paste_content"
// }
