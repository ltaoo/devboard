package models

import (
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	Id                string         `json:"id" gorm:"primaryKey"`
	LastOperationTime string         `json:"last_operation_time" gorm:"column:last_operation_time"`
	LastOperationType int            `json:"last_operation_type" gorm:"column:last_operation_type"`
	SyncStatus        int            `json:"-" gorm:"column:sync_status"`
	CreatedAt         string         `json:"created_at" gorm:"column:created_at"`
	UpdatedAt         string         `json:"updated_at,omitempty"`
	DeletedAt         gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

func (p *BaseModel) BeforeCreate(tx *gorm.DB) error {
	now_timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	if p.Id == "" {
		p.Id = uuid.New().String()
	}
	if p.CreatedAt == "" {
		p.CreatedAt = now_timestamp
	}
	if p.LastOperationTime == "" {
		p.LastOperationTime = now_timestamp
	}
	if p.LastOperationType == 0 {
		p.LastOperationType = 1
	}
	if p.SyncStatus == 0 {
		p.SyncStatus = 1
	}
	return nil
}
func (p *BaseModel) BeforeUpdate(tx *gorm.DB) error {
	fmt.Println("[HOOK]BeforeUpdate", p.DeletedAt.Valid)
	now_timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	p.LastOperationTime = now_timestamp
	p.LastOperationType = 2
	if p.DeletedAt.Valid {
		p.LastOperationType = 3
	}
	p.SyncStatus = 1
	p.UpdatedAt = now_timestamp
	return nil
}
