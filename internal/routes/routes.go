package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"devboard/config"
	"devboard/pkg/logger"
)

type Result struct {
	// Code int         `json:"code"`
	// Msg  string      `json:"msg"`
	// Data interface{} `json:"data"`

	c *gin.Context
}

func (r *Result) BindContext(c *gin.Context) {
	r.c = c
}
func (r *Result) Error(err string) {
	r.c.JSON(http.StatusOK, gin.H{"code": 400, "msg": err, "data": nil})
}
func (r *Result) Ok(data interface{}) {
	r.c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "", "data": data})
}

func SetupRouter(db *gorm.DB, logger *logger.Logger, cfg *config.Config, machine_id string) *gin.Engine {
	// 设置Gin模式
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// 使用中间件
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	api := r.Group("/api")

	paste := NewPasteHandler(db, machine_id)
	api.GET("/paste_event/list", paste.FetchPasteEventList)
	ocr := NewOCRHandler(db)
	api.POST("/ocr/recognize", ocr.Recognize)

	return r
}
