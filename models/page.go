package models

type Pagination struct {
	Page       int    `json:"page" binding:"required,min=1" form:"page,default=1"`
	PageSize   int    `json:"page_size" form:"page_size,default=10"`
	NextMarker string `json:"next_marker" form:"next_marker"`

	// Page     int `json:"page" binding:"required,min=1"`
	// PageSize int `json:"page_size" binding:"required,min=1,max=100"`
}
