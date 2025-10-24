package models

type CategoryNode struct {
	BaseModel   `gorm:"embedded"`
	Label       string `json:"label" gorm:"size:100;not null"`
	Description string `json:"description,omitempty" gorm:"type:text"`
	Level       int    `json:"level,omitempty" gorm:"default:0"`
	SortOrder   int    `json:"sort_order" gorm:"default:0"`
	IsActive    bool   `json:"is_active" gorm:"default:true"`

	Parents     []CategoryNode `json:"parents" gorm:"many2many:category_hierarchy;foreignKey:Id;joinForeignKey:ChildId;References:Id;joinReferences:ParentId"`
	Children    []CategoryNode `json:"children" gorm:"many2many:category_hierarchy;foreignKey:Id;joinForeignKey:ChildId;References:Id;joinReferences:ParentId"`
	PasteEvents []PasteEvent   `json:"paste_events" gorm:"many2many:paste_event_category_mapping;joinForeignKey:category_id;joinReferences:paste_event_id;"`
}

func (CategoryNode) TableName() string {
	return "category_node"
}

type CategoryHierarchy struct {
	BaseModel `gorm:"embedded"`
	ParentId  string `json:"parent_id" gorm:"primaryKey"`
	ChildId   string `json:"child_id" gorm:"primaryKey"`
}

func (CategoryHierarchy) TableName() string {
	return "category_hierarchy"
}

type PasteEventCategoryMapping struct {
	BaseModel    `gorm:"embedded"`
	PasteEventId string `json:"paste_event_id" gorm:"column:paste_event_id;primaryKey"`
	CategoryId   string `json:"category_id" gorm:"column:category_id;primaryKey"`
}

func (PasteEventCategoryMapping) TableName() string {
	return "paste_event_category_mapping"
}
