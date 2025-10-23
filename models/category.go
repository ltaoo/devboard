package models

import (
	"time"
)

type CategoryNode struct {
	Id                string     `json:"id" gorm:"primaryKey"`
	Label             string     `json:"label" gorm:"size:100;not null"`
	Description       string     `json:"description" gorm:"type:text"`
	Level             int        `json:"level" gorm:"default:0"`
	SortOrder         int        `json:"sort_order" gorm:"default:0"`
	IsActive          bool       `json:"is_active" gorm:"default:true"`
	LastOperationTime string     `json:"last_operation_time"`
	LastOperationType int        `json:"last_operation_type"`
	CreatedAt         string     `json:"created_at"`
	UpdatedAt         *time.Time `json:"updated_at"`

	Parents     []CategoryNode `json:"parents" gorm:"many2many:category_hierarchy;foreignKey:Id;joinForeignKey:ChildId;References:Id;joinReferences:ParentId"`
	Children    []CategoryNode `json:"children" gorm:"many2many:category_hierarchy;foreignKey:Id;joinForeignKey:ChildId;References:Id;joinReferences:ParentId"`
	PasteEvents []PasteEvent   `json:"paste_events" gorm:"many2many:paste_event_category_mapping;joinForeignKey:category_id;joinReferences:paste_event_id;"`
}

func (CategoryNode) TableName() string {
	return "category_node"
}

type CategoryHierarchy struct {
	ParentId          string     `gorm:"primaryKey"`
	ChildId           string     `gorm:"primaryKey"`
	LastOperationTime string     `json:"last_operation_time"`
	LastOperationType int        `json:"last_operation_type"`
	CreatedAt         string     `json:"created_at"`
	UpdatedAt         *time.Time `json:"updated_at"`
}

func (CategoryHierarchy) TableName() string {
	return "category_hierarchy"
}

type PasteEventCategoryMapping struct {
	Id                string `json:"id"`
	PasteEventId      string `json:"paste_event_id" gorm:"primaryKey;column:paste_event_id"`
	CategoryId        string `json:"category_id" gorm:"primaryKey;column:category_id"`
	LastOperationTime string `json:"last_operation_time"`
	LastOperationType int    `json:"last_operation_type"`
	CreatedAt         string `json:"created_at"`
}

func (PasteEventCategoryMapping) TableName() string {
	return "paste_event_category_mapping"
}
