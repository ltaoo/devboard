package biz

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type UserSettings struct {
	config_dir      string
	config_filename string

	Value map[string]interface{}
	// UserSettingsValue
}

type UserSettingsValue struct {
	Douyin struct {
		Cookie string `json:"cookie"`
	} `json:"douyin"`
	Shortcut struct {
		ToggleMainWindowVisible string //切换主窗口可见
		DisableWatchClipboard   string // 禁用粘贴板监听
		EnableWatchClipboard    string // 启用粘贴板监听
	} `json:"shortcut"`
	PasteEvent struct {
		CallbackEndpoint string `json:"callback_endpoint"`
	} `json:"paste_event"`
}

func NewBizConfig(dir string, filename string) *UserSettings {
	c := UserSettings{
		config_dir:      dir,
		config_filename: filename,
	}
	return &c
	// value, err := c.ReadConfig()
	// if err != nil {
	// 	return nil, err
	// }
	// c.Value = value
	// return &c, nil
}

func (c *UserSettings) InitializeConfig() {
	config_file_path := filepath.Join(c.config_dir, c.config_filename)
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

func (c *UserSettings) ReadConfig() (map[string]interface{}, error) {
	config_file_path := filepath.Join(c.config_dir, c.config_filename)
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

func (c *UserSettings) WriteConfig(data map[string]interface{}) error {
	n, err := json.Marshal(data)
	if err != nil {
		return nil
	}
	config_file_path := filepath.Join(c.config_dir, c.config_filename)
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

func (c *UserSettings) Get(path string, default_value any) any {
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

func (c *UserSettings) Set(data map[string]interface{}) error {
	c.Value = data
	return c.WriteConfig(data)
}

func Get[R any](config *UserSettings, path string, default_value R) R {
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
