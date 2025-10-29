package biz

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type BizConfig struct {
	ConfigDir  string
	ConfigName string
	Value      map[string]interface{}
}

type UserConfigValue struct {
	Douyin struct {
		Cookie string `json:"cookie"`
	} `json:"douyin"`
	PasteEvent struct {
		CallbackEndpoint string `json:"callback_endpoint"`
	} `json:"paste_event"`
}

func NewBizConfig(dir string, filename string) *BizConfig {
	c := BizConfig{
		ConfigDir:  dir,
		ConfigName: filename,
	}
	return &c
	// value, err := c.ReadConfig()
	// if err != nil {
	// 	return nil, err
	// }
	// c.Value = value
	// return &c, nil
}

func (c *BizConfig) InitializeConfig() {
	config_file_path := filepath.Join(c.ConfigDir, c.ConfigName)
	_, err := os.Stat(config_file_path)
	if err != nil {
		c.Value = make(map[string]interface{})
		c.WriteConfig(c.Value)
		return
	}
	v, err := c.ReadConfig()
	if err != nil {
		c.Value = make(map[string]interface{})
		return
	}
	c.Value = v
}

func (c *BizConfig) ReadConfig() (map[string]interface{}, error) {
	config_file_path := filepath.Join(c.ConfigDir, c.ConfigName)
	b, err := os.ReadFile(config_file_path)
	if err != nil {
		return nil, err
	}
	var data map[string]interface{}
	if err := json.Unmarshal(b, &data); err != nil {
		return nil, err
	}
	c.Value = data
	return data, nil
}

func (c *BizConfig) WriteConfig(data map[string]interface{}) error {
	n, err := json.Marshal(data)
	if err != nil {
		return nil
	}
	config_file_path := filepath.Join(c.ConfigDir, c.ConfigName)
	config_file, err := os.OpenFile(config_file_path, os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer config_file.Close()
	_, err = config_file.Write(n)
	if err != nil {
		return err
	}
	c.Value = data
	return nil
}

func (c *BizConfig) Get(path string, default_value any) any {
	result := get_raw(c.Value, path)
	if result == nil {
		return default_value
	}
	return result
	// if v, ok := result.(T); ok {
	// 	return v
	// }
	// return default_value
}

func (c *BizConfig) Set(data map[string]interface{}) error {
	c.Value = data
	return c.WriteConfig(data)
}

func Get[R any](config *BizConfig, path string, default_value R) R {
	return get[R](config.Value, path, default_value)
}

func get[T any](m interface{}, path string, default_value T) T {
	result := get_raw(m, path)
	if result == nil {
		return default_value
	}
	if v, ok := result.(T); ok {
		return v
	}
	return default_value
}

func get_raw(m interface{}, path string) interface{} {
	keys := strings.Split(path, ".")
	var current interface{} = m

	for _, key := range keys {
		switch v := current.(type) {
		case map[string]interface{}:
			if val, exists := v[key]; exists {
				current = val
			} else {
				return nil
			}
		case []interface{}:
			if idx, err := strconv.Atoi(key); err == nil && idx >= 0 && idx < len(v) {
				current = v[idx]
			} else {
				return nil
			}
		default:
			return nil
		}
	}

	return current
}
