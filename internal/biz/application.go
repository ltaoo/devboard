package biz

import (
	"fmt"

	"gorm.io/gorm"

	"devboard/config"
)

func New() *App {
	return &App{}
}

type App struct {
	DB     *gorm.DB
	Config *config.Config
	Name   string
}

func (a *App) Set(db *gorm.DB, config *config.Config) {
	a.DB = db
	a.Config = config
	a.Name = "devboard"
}
func (a *App) Ensure() error {
	if a.DB == nil {
		return fmt.Errorf("Please wait the database initialized")
	}
	return nil
}
