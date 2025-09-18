package service

import "os"

type ConfigService struct {
}

func (s *ConfigService) Read() *Result {
	user_config_dir, err := os.UserConfigDir()
	if err != nil {
		return Error(err)
	}
	return Ok(map[string]interface{}{
		"data_dir": user_config_dir,
	})
}
