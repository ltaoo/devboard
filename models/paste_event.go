package models

import (
	"time"

	"gorm.io/gorm"
)

type PasteEvent struct {
	Id          int            `json:"id"`
	ContentType string         `json:"content_type"`
	CreatedAt   time.Time      `json:"created_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	ContentId int          `json:"content_id"`
	Content   PasteContent `json:"content"`
}

func (PasteEvent) TableName() string {
	return "paste_event"
}

type PasteContent struct {
	Id          int            `json:"id"`
	ContentType string         `json:"content_type"`
	Text        string         `json:"text"`
	Html        string         `json:"html"`
	FileJSON    string         `json:"file_json"`
	ImageBase64 string         `json:"image_base64"`
	Other       string         `json:"other"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
}

func (PasteContent) TableName() string {
	return "paste_content"
}
