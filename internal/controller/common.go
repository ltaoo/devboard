package controller

import (
	"gorm.io/gorm"

	"devboard/models"
)

type AppController struct {
	db *gorm.DB
}

func NewAppController(db *gorm.DB) *AppController {
	return &AppController{
		db: db,
	}
}

type AppListBody struct {
}

type AppResp struct {
	Id      string
	Name    string
	LogoURL string
}

func (s *AppController) FetchAppList(body AppListBody) ([]*models.App, error) {
	var list []*models.App
	if err := s.db.Where("1 = 1").Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

type DeviceController struct {
	db *gorm.DB
}

func NewDeviceController(db *gorm.DB) *DeviceController {
	return &DeviceController{
		db: db,
	}
}

type DeviceListBody struct {
}

func (s *DeviceController) FetchDeviceList(body DeviceListBody) ([]*models.Device, error) {
	var list []*models.Device
	if err := s.db.Where("1 = 1").Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}
