package biz

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"devboard/config"
)

func New() *App {
	return &App{}
}

type App struct {
	Name                       string
	Config                     *config.Config
	UserConfig                 *BizConfig
	DB                         *gorm.DB
	ManuallyWriteClipboardTime time.Time
}

func (a *App) SetName(name string) {
	a.Name = name
}
func (a *App) SetDatabase(db *gorm.DB) {
	a.DB = db
}
func (a *App) SetConfig(config *config.Config) {
	a.Config = config
}
func (a *App) SetUserConfig(config *BizConfig) {
	a.UserConfig = config
}
func (a *App) Ensure() error {
	if a.DB == nil {
		return fmt.Errorf("Please wait the database initialized")
	}
	return nil
}
