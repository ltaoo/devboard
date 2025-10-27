package db

import (
	"gorm.io/gorm"

	"devboard/models"
	"devboard/pkg/system"
)

func Seed(db *gorm.DB, machine_id string) {
	var devices []models.Device
	if err := db.Where("1 = 1").Limit(1).Find(&devices).Error; err != nil {
		return
	}
	if len(devices) == 0 {
		computer_name, err := system.GetComputerName()
		if err != nil {
			return
		}
		created_device := models.Device{
			Name:       computer_name,
			MacAddress: machine_id,
			BaseModel: models.BaseModel{
				Id: machine_id,
			},
		}
		if err := db.Create(&created_device).Error; err != nil {
			return
		}
	}
	var apps []models.App
	if err := db.Where("1 = 1").Limit(1).Find(&apps).Error; err != nil {
		return
	}
	if len(apps) == 0 {
		created_app := models.App{
			Name:     "Unknown",
			UniqueId: "unknown",
			LogoURL:  "",
			BaseModel: models.BaseModel{
				Id: "unknown",
			},
		}
		if err := db.Create(&created_app).Error; err != nil {
			return
		}
	}
}
