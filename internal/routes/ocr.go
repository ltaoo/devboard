package routes

import (
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"devboard/models"
	"devboard/pkg/ocr"
)

type OCRHandler struct {
	Result
	db *gorm.DB
}

func NewOCRHandler(db *gorm.DB) *OCRHandler {
	return &OCRHandler{
		db: db,
	}
}

type OCRRecognizeBody struct {
	PasteEventId string `json:"paste_event_id"`
	ImageBase64  string `json:"image_base64"`
	Lang         string `json:"lang"`
	Endpoint     string `json:"endpoint"`
}

func (h *OCRHandler) Recognize(c *gin.Context) {
	var body OCRRecognizeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1000, "msg": err.Error(), "data": nil})
		return
	}
	var imgBytes []byte
	if body.PasteEventId != "" {
		var record models.PasteEvent
		if err := h.db.Where("id = ?", body.PasteEventId).First(&record).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"code": 1001, "msg": err.Error(), "data": nil})
			return
		}
		if record.ContentType != "image" || record.ImageBase64 == "" {
			c.JSON(http.StatusOK, gin.H{"code": 1002, "msg": "not an image paste event", "data": nil})
			return
		}
		data, err := base64.StdEncoding.DecodeString(record.ImageBase64)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"code": 1003, "msg": "invalid base64", "data": nil})
			return
		}
		imgBytes = data
	} else {
		if body.ImageBase64 == "" {
			c.JSON(http.StatusOK, gin.H{"code": 1004, "msg": "missing image", "data": nil})
			return
		}
		raw := body.ImageBase64
		if len(raw) > 22 && (raw[:22] == "data:image/png;base64," || raw[:22] == "data:image/jpeg;base64,") {
			raw = raw[22:]
		}
		data, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"code": 1005, "msg": "invalid base64", "data": nil})
			return
		}
		imgBytes = data
	}
	lang := body.Lang
	if lang == "" {
		lang = "eng"
	}
	text, err := ocr.RecognizeBytes(imgBytes, lang)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1014, "msg": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "", "data": gin.H{"text": text}})
}
