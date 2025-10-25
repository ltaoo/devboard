package models

type PasteEvent struct {
	BaseModel    `gorm:"embedded"`
	ContentType  string `json:"content_type"`
	Text         string `json:"text,omitempty"`
	Html         string `json:"html,omitempty"`
	FileListJSON string `json:"file_list_json,omitempty"`
	ImageBase64  string `json:"image_base64,omitempty"`
	Other        string `json:"other,omitempty"`
	Details      string `json:"details"`
	AppId        string `json:"app_id,omitempty"`
	DeviceId     string `json:"device_id,omitempty"`

	Categories []CategoryNode `json:"categories" gorm:"many2many:paste_event_category_mapping;joinForeignKey:paste_event_id;JoinReferences:category_id"`
	Remarks    []Remark       `json:"remarks" gorm:"ForeignKey:PasteEventId"`
}

func (PasteEvent) TableName() string {
	return "paste_event"
}

type Device struct {
	BaseModel  `gorm:"embedded"`
	Name       string `json:"name"`
	MacAddress string `json:"mac_address"`
}

func (Device) TableName() string {
	return "device"
}

type App struct {
	BaseModel `gorm:"embedded"`
	Name      string `json:"name"`
	UniqueId  string `json:"unique_id"`
	LogoURL   string `json:"logo_url"`
}

func (App) TableName() string {
	return "app"
}
