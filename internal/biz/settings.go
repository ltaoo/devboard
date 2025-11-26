package biz

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
)

// user preferences

type UserSettings struct {
	config_dir      string
	config_filename string

	Value *UserSettingsValue
	// Value map[string]interface{}
	// UserSettingsValue
}

type UserSettingsValue struct {
	Douyin struct {
		Cookie string `json:"cookie"`
	} `json:"douyin"`
	Shortcut struct {
		ToggleMainWindowVisible string `json:"toggle_main_window_visible"` //切换主窗口可见
		DisableWatchClipboard   string `json:"disable_watch_clipboard"`    // 禁用粘贴板监听
		EnableWatchClipboard    string `json:"enable_watch_clipboard"`     // 启用粘贴板监听
	} `json:"shortcut"`
	PasteEvent struct {
		CallbackEndpoint string `json:"callback_endpoint"`
	} `json:"paste_event"`
	Synchronize struct {
		Webdav struct {
			Url      string `json:"url"`
			Username string `json:"username"`
			Password string `json:"password"`
			RootDir  string `json:"root_dir"`
		} `json:"webdav"`
	} `json:"synchronize"`
	AutoStart bool `json:"auto_start"` // 开机自启
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
		c.Value = &UserSettingsValue{}
		c.WriteConfig(c.Value)
		return
	}
	v, err := c.ReadConfig()
	if err != nil {
		c.Value = &UserSettingsValue{}
		return
	}
	c.Value = v
}

func (c *UserSettings) ReadConfig() (*UserSettingsValue, error) {
	config_file_path := filepath.Join(c.config_dir, c.config_filename)
	b, err := os.ReadFile(config_file_path)
	if err != nil {
		return nil, err
	}
	var data UserSettingsValue
	if err := json.Unmarshal(b, &data); err != nil {
		return nil, err
	}
	c.Value = &data
	return c.Value, nil
}

func (c *UserSettings) WriteValueWithPath(path string, data interface{}) error {
	// parts := strings.Split(path, ".")
	// return updateField(reflect.ValueOf(c.Value).Elem(), parts, data)
	// 将结构体转换为map
	json_settings := make(map[string]interface{})
	b, err := json.Marshal(c.Value)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, &json_settings); err != nil {
		return err
	}
	// 更新map中的值
	parts := strings.Split(path, ".")
	current := json_settings
	for i, part := range parts {
		if i == len(parts)-1 {
			current[part] = data
		} else {
			if next, ok := current[part].(map[string]interface{}); ok {
				current = next
			} else {
				return fmt.Errorf("invalid path: %s", path)
			}
		}
	}
	// 将map转换回结构体
	b, err = json.Marshal(json_settings)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, c.Value); err != nil {
		return err
	}
	c.WriteConfig(c.Value)
	return nil
}

func updateField(v reflect.Value, path []string, data interface{}) error {
	if len(path) == 0 {
		return nil
	}

	// 如果是指针，获取其指向的值
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	// 查找字段
	fieldName := path[0]
	field := v.FieldByName(strings.Title(fieldName)) // Go字段名首字母大写

	if !field.IsValid() {
		return fmt.Errorf("field %s not found", fieldName)
	}

	// 如果是最后一级路径，设置值
	if len(path) == 1 {
		if field.CanSet() {
			newValue := reflect.ValueOf(data)
			if newValue.Type().AssignableTo(field.Type()) {
				field.Set(newValue)
				return nil
			}
			return fmt.Errorf("type mismatch: cannot assign %v to %v", newValue.Type(), field.Type())
		}
		return fmt.Errorf("field %s cannot be set", fieldName)
	}

	// 递归处理嵌套结构
	if field.Kind() == reflect.Struct {
		return updateField(field, path[1:], data)
	}

	return fmt.Errorf("field %s is not a struct", fieldName)
}

func (c *UserSettings) WriteConfig(data interface{}) error {
	n, err := json.Marshal(data)
	if err != nil {
		return nil
	}
	config_file_path := filepath.Join(c.config_dir, c.config_filename)
	config_file, err := os.OpenFile(config_file_path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer config_file.Close()
	_, err = config_file.Write(n)
	if err != nil {
		return err
	}
	v, ok := data.(*UserSettingsValue)
	if !ok {
		return fmt.Errorf("can't parse the values")
	}
	c.Value = v
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

func (c *UserSettings) Set(data *UserSettingsValue) error {
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
