package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"devboard/internal/controller"
)

type PasteHandler struct {
	Result

	con *controller.PasteController
}

func NewPasteHandler(db *gorm.DB, machine_id string) *PasteHandler {
	return &PasteHandler{
		con: controller.NewPasteController(db, machine_id),
	}
}

func (h *PasteHandler) FetchPasteEventList(c *gin.Context) {
	var body controller.PasteListBody
	if err := c.ShouldBindQuery(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1000, "msg": err.Error(), "data": nil})
		return
	}
	h.BindContext(c)
	list, err := h.con.FetchPasteEventList(body)
	if err != nil {
		// h.Error(err.Error())
		c.JSON(http.StatusOK, gin.H{"code": 1001, "msg": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": err, "data": list})
	// h.Ok(list)
}
