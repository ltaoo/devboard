package db

import (
	"fmt"
	"os"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"devboard/config"
)

func NewDatabase(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector
	fmt.Printf("[INTERNAL]db/database - NewDatabase: DBType=%s, DBPath=%s\n", cfg.DBType, cfg.DBPath)

	switch cfg.DBType {
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)
		dialector = mysql.Open(dsn)
	case "postgres":
		dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
			cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort)
		dialector = postgres.Open(dsn)
	case "sqlite":
		// 确保数据库目录存在
		dbDir := cfg.DBPath
		if lastSlash := strings.LastIndex(dbDir, "/"); lastSlash != -1 {
			dbDir = dbDir[:lastSlash]
			if err := os.MkdirAll(dbDir, 0755); err != nil {
				return nil, fmt.Errorf("failed to create database directory %s: %w", dbDir, err)
			}
		}
		fmt.Printf("[INTERNAL]db/database - SQLite database path: %s\n", cfg.DBPath)
		dialector = sqlite.Open(cfg.DBPath + "?_busy_timeout=5000&_journal=WAL&_synchronous=NORMAL")
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cfg.DBType)
	}

	// 配置GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	if cfg.Environment == "production" {
		gormConfig.Logger = logger.Default.LogMode(logger.Error)
	}

	// 连接数据库
	db, err := gorm.Open(dialector, gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}
