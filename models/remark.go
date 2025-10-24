package models

type Remark struct {
	BaseModel    `gorm:"embedded"`
	Content      string `json:"content"`
	PasteEventId string `json:"paste_event_id"`
}

func (Remark) TableName() string {
	return "remark"
}
