package db

import (
	"devboard/models"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"
)

func sptr(s string) *string {
	return &s
}

var BuiltinCategories = []models.CategoryNode{
	{
		Id:    "text",
		Label: "text",
	},
	{
		Id:    "image",
		Label: "image",
	},
	{
		Id:    "file",
		Label: "file",
	},
	{
		Id:    "html",
		Label: "html",
	},
	{
		Id:    "code",
		Label: "code",
	},
	{
		Id:    "prompt",
		Label: "prompt",
	},
	{
		Id:    "snippet",
		Label: "snippet",
	},
	{
		Id:    "url",
		Label: "url",
	},
	{
		Id:    "time",
		Label: "time",
	},
	{
		Id:    "color",
		Label: "color",
	},
	{
		Id:    "command",
		Label: "command",
	},
	{
		Id:    "JSON",
		Label: "JSON",
	},
	{
		Id:    "XML",
		Label: "XML",
	},
	{
		Id:    "HTML",
		Label: "HTML",
	},
	{
		Id:    "Go",
		Label: "Go",
	},
	{
		Id:    "Rust",
		Label: "Rust",
	},
	{
		Id:    "Python",
		Label: "Python",
	},
	{
		Id:    "Java",
		Label: "Java",
	},
	{
		Id:    "JavaScript",
		Label: "JavaScript",
	},
	{
		Id:    "TypeScript",
		Label: "TypeScript",
	},
	{
		Id:    "SQL",
		Label: "SQL",
	},
}

var BuiltinCategoryHierarchy = []models.CategoryHierarchy{
	{
		ParentId: "code",
		ChildId:  "JSON",
	},
	{
		ParentId: "code",
		ChildId:  "XML",
	},
	{
		ParentId: "code",
		ChildId:  "HTML",
	},
	{
		ParentId: "code",
		ChildId:  "Go",
	},
	{
		ParentId: "code",
		ChildId:  "Rust",
	},
	{
		ParentId: "code",
		ChildId:  "Python",
	},
	{
		ParentId: "code",
		ChildId:  "Java",
	},
	{
		ParentId: "code",
		ChildId:  "JavaScript",
	},
	{
		ParentId: "code",
		ChildId:  "TypeScript",
	},
	{
		ParentId: "code",
		ChildId:  "SQL",
	},
	{
		ParentId: "snippet",
		ChildId:  "JSON",
	},
	{
		ParentId: "snippet",
		ChildId:  "XML",
	},
	{
		ParentId: "snippet",
		ChildId:  "HTML",
	},
	{
		ParentId: "snippet",
		ChildId:  "Go",
	},
	{
		ParentId: "snippet",
		ChildId:  "Rust",
	},
	{
		ParentId: "snippet",
		ChildId:  "Python",
	},
	{
		ParentId: "snippet",
		ChildId:  "Java",
	},
	{
		ParentId: "snippet",
		ChildId:  "JavaScript",
	},
	{
		ParentId: "snippet",
		ChildId:  "TypeScript",
	},
	{
		ParentId: "snippet",
		ChildId:  "SQL",
	},
}

func Seed(db *gorm.DB) {
	now := time.Now()
	for _, category := range BuiltinCategories {
		var existing models.CategoryNode
		if err := db.Where("id = ?", category.Id).First(&existing).Error; err != nil {
			if err != gorm.ErrRecordNotFound {
				continue
			}
			category.LastOperationTime = strconv.FormatInt(now.UnixMilli(), 10)
			category.LastOperationType = 1
			if err := db.Create(&category).Error; err != nil {
				fmt.Println("create failed", err.Error())
			}
			continue
		}
		if existing.CreatedAt == nil {
			existing.CreatedAt = &now
			if err := db.Model(&category).Update("created_at", &now).Error; err != nil {
				fmt.Println("create failed", err.Error())
			}
		}
		if existing.LastOperationTime == "" {
			if err := db.Model(&category).Update("last_operation_time", strconv.FormatInt(now.UnixMilli(), 10)).Error; err != nil {
				fmt.Println("create failed", err.Error())
			}
		}
	}
	for _, hierarchy := range BuiltinCategoryHierarchy {
		var existing models.CategoryHierarchy
		if err := db.Where("parent_id = ? AND child_id = ?", hierarchy.ParentId, hierarchy.ChildId).First(&existing).Error; err != nil {
			if err != gorm.ErrRecordNotFound {
				continue
			}
			hierarchy.LastOperationTime = strconv.FormatInt(now.UnixMilli(), 10)
			hierarchy.LastOperationType = 1
			if err := db.Create(&hierarchy).Error; err != nil {
				fmt.Println("create failed", err.Error())
			}
			continue
		}
		if existing.CreatedAt == nil {
			existing.CreatedAt = &now
			if err := db.Model(&hierarchy).Update("created_at", &now).Error; err != nil {
				fmt.Println("create failed", err.Error())
			}
		}
		if existing.LastOperationTime == "" {
			if err := db.Model(&hierarchy).Update("last_operation_time", strconv.FormatInt(now.UnixMilli(), 10)).Error; err != nil {
				fmt.Println("create failed", err.Error())
			}
		}
	}
}
