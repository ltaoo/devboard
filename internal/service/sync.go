package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/samber/lo"
	"github.com/studio-b12/gowebdav"
	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/internal/biz"
	"devboard/models"
)

type SyncService struct {
	App *application.App
	Biz *biz.App
}

type FileNode struct {
	Name     string      `json:"name"`
	Filepath string      `json:"filepath"`
	Type     string      `json:"type"` // "file" 或 "folder"
	Content  string      `json:"content,omitempty"`
	Files    []*FileNode `json:"files,omitempty"`
}

func (s *SyncService) PingWebDav(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	return Ok(map[string]interface{}{
		"ok": true,
	})
}

type WebDavSyncConfigBody struct {
	URL      string `json:"url"`
	RootDir  string `json:"root_dir"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *SyncService) ExportRecordList(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}

	// root_dir := "/Users/mayfair/Documents/export_ttt"
	table_name := "paste_event"
	table_out_dir := filepath.Join(body.RootDir, table_name)
	remote_last_operation_time_filename := "last_operation_time"
	remote_last_operation_time_filepath := filepath.Join(table_out_dir, remote_last_operation_time_filename)

	var records []map[string]interface{}
	result := s.Biz.DB.Table(table_name).Order("last_operation_time DESC").Find(&records)
	if result.Error != nil {
		return Error(fmt.Errorf("查询记录失败: %v", result.Error))
	}

	var files []*FileNode
	// root := &FileNode{
	// 	Name:  out_dir,
	// 	Type:  "folder",
	// 	Files: []*FileNode{},
	// }
	if len(records) == 0 {
		return Ok(files)
	}
	table_last_record := records[0]
	table_last_operation_time := table_last_record["last_operation_time"].(string)
	millis, err := strconv.ParseInt(table_last_operation_time, 10, 64)
	// _record_last_operation_time, err := time.Parse("20060102", table_last_operation_time)
	if err != nil {
		return Error(err)
	}
	_record_last_operation_time := time.Unix(0, millis*int64(time.Millisecond))
	_, err = client.Stat(remote_last_operation_time_filepath)
	if err != nil {
		if !gowebdav.IsErrNotFound(err) {
			return Error(err)
		}
		// 文件不存在
	} else {
		// 文件存在
		remote_last_operation_time_byte, err := client.Read(remote_last_operation_time_filepath)
		if err != nil {
			return Error(err)
		}
		remote_last_operation_time := string(remote_last_operation_time_byte)
		remote_millis, err := strconv.ParseInt(remote_last_operation_time, 10, 64)
		if err != nil {
			return Error(err)
		}
		_remote_last_operation_time := time.Unix(0, remote_millis*int64(time.Millisecond))
		// _remote_last_operation_time, err := time.Parse("20060102", remote_last_operation_time)
		// 如果本地数据库，最新的记录时间在 webdav 之前，说明需要 同步到本地，而不能 同步到远端
		if _record_last_operation_time.Before(_remote_last_operation_time) {
			return Ok(nil)
		}

	}

	files = append(files, &FileNode{
		Name:     remote_last_operation_time_filename,
		Filepath: remote_last_operation_time_filepath,
		Type:     "file",
		Content:  table_last_operation_time,
	})

	// 按天分组记录
	day_groups := make(map[string][]map[string]interface{})
	for _, record := range records {
		created_at, ok := record["created_at"].(time.Time)
		if !ok {
			continue
		}
		day_key := created_at.Format("20060102") // 格式化为 YYYYMMDD
		day_groups[day_key] = append(day_groups[day_key], record)
	}
	for day, day_records := range day_groups {
		day_dir := filepath.Join(table_out_dir, day)
		// if err := os.MkdirAll(day_dir, 0755); err != nil {
		// 	return Error(fmt.Errorf("创建日期目录失败: %v", err))
		// }
		day_node := &FileNode{
			Name:     day,
			Filepath: day_dir,
			Type:     "folder",
			Files:    []*FileNode{},
		}
		_, ok := lo.Find(files, func(v *FileNode) bool {
			return v.Filepath == day_dir
		})
		if !ok {
			files = append(files, day_node)
		}

		var _day_last_operation_time time.Time

		for _, record := range day_records {
			// 将记录转为JSON
			record_json, err := json.Marshal(record)
			if err != nil {
				return Error(fmt.Errorf("JSON序列化失败: %v", err))
			}
			// 获取最后修改时间
			_last_operation_time, ok := record["last_operation_time"].(time.Time)
			if !ok {
				_last_operation_time = time.Now()
			}
			if _last_operation_time.After(_day_last_operation_time) {
				_day_last_operation_time = _last_operation_time
			}
			uid := fmt.Sprintf("%v", record["id"])
			// last_operation_time := fmt.Sprintf("%d", _last_operation_time.Unix())
			last_operation_time := strconv.FormatInt(_last_operation_time.UnixMilli(), 10)
			last_operation_type := fmt.Sprintf("%d", record["last_operation_type"])

			record_filepath := filepath.Join(day_dir, uid)
			files = append(files, &FileNode{
				Name:     uid,
				Filepath: record_filepath,
				Type:     "folder",
				Files:    []*FileNode{},
			})
			// if err := os.MkdirAll(record_filepath, 0755); err != nil {
			// 	return Error(fmt.Errorf("创建数据目录失败: %v", err))
			// }
			data_filename := "data"
			data_filepath := filepath.Join(record_filepath, data_filename)
			files = append(files, &FileNode{
				Name:     data_filename,
				Filepath: data_filepath,
				Type:     "file",
				Content:  string(record_json),
			})
			// if err := os.WriteFile(data_filepath, record_json, 0644); err != nil {
			// 	return Error(fmt.Errorf("写入数据文件失败: %v", err))
			// }

			last_operation_time_filename := "last_operation_time"
			last_time_filepath := filepath.Join(record_filepath, last_operation_time_filename)
			files = append(files, &FileNode{
				Name:     last_operation_time_filename,
				Filepath: last_time_filepath,
				Type:     "file",
				Content:  last_operation_time,
			})
			// if err := os.WriteFile(last_time_filepath, []byte(last_operation_time), 0644); err != nil {
			// 	return Error(fmt.Errorf("写入操作时间文件失败: %v", err))
			// }
			last_operation_type_filename := "last_operation_type"
			last_type_filepath := filepath.Join(record_filepath, last_operation_type_filename)
			files = append(files, &FileNode{
				Name:     last_operation_type_filename,
				Filepath: last_type_filepath,
				Type:     "file",
				Content:  last_operation_type,
			})
			// if err := os.WriteFile(last_type_filepath, []byte(last_operation_type), 0644); err != nil {
			// 	return Error(fmt.Errorf("写入操作类型文件失败: %v", err))
			// }

			// day_node.Files = append(day_node.Files, &FileNode{
			// 	Name:    last_operation_time_filename,
			// 	Type:    "file",
			// 	Content: last_operation_time,
			// })
			// day_node.Files = append(day_node.Files, &FileNode{
			// 	Name:    last_operation_type_filename,
			// 	Type:    "file",
			// 	Content: last_operation_type,
			// })
		}

		day_last_operation_time_filename := "last_operation_time"
		day_last_time_filepath := filepath.Join(day_dir, day_last_operation_time_filename)
		day_last_operation_time := strconv.FormatInt(_day_last_operation_time.UnixMilli(), 10)
		files = append(files, &FileNode{
			Name:     day_last_operation_time_filename,
			Filepath: day_last_time_filepath,
			Type:     "file",
			Content:  day_last_operation_time,
		})

	}

	for _, file := range files {
		if file.Type == "folder" {
			if !strings.HasSuffix(file.Filepath, "/") {
				file.Filepath += "/"
			}
			// 使用 MkdirAll 创建目录（包括父目录）
			if err := client.MkdirAll(file.Filepath, 0755); err != nil {
				return Error(fmt.Errorf("创建目录失败: %v", err))
			}
			// if err := os.MkdirAll(file.Filepath, 0755); err != nil {
			// 	return Error(fmt.Errorf("创建目录失败: %v", err))
			// }
		}
		if file.Type == "file" {
			data := []byte(file.Content)
			// 写入文件
			if err := client.Write(file.Filepath, data, 0644); err != nil {
				return Error(fmt.Errorf("写入文件失败: %v", err))
			}
			// if err := os.WriteFile(file.Filepath, []byte(file.Content), 0644); err != nil {
			// 	return Error(fmt.Errorf("写入文件失败: %v", err))
			// }
		}
	}

	return Ok(files)
}

func get_day_timestamp_range(dateStr string) (start_time, end_time int64, err error) {
	// 解析日期字符串
	date, err := time.Parse("20060102", dateStr)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid date format, expected YYYYMMDD: %v", err)
	}
	// 获取当天的开始时间(00:00:00)
	day_start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	// 获取当天的结束时间(23:59:59)
	day_end := time.Date(date.Year(), date.Month(), date.Day(), 23, 59, 59, 0, date.Location())

	// 转换为时间戳
	return day_start.Unix(), day_end.Unix(), nil
}

func (s *SyncService) ImportFileList(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}

	table_name := "paste_event"
	table_out_dir := filepath.Join(body.RootDir, table_name)
	remote_last_operation_time_filename := "last_operation_time"
	remote_last_operation_time_filepath := filepath.Join(table_out_dir, remote_last_operation_time_filename)

	_, err = client.Stat(remote_last_operation_time_filepath)
	if err != nil {
		if !gowebdav.IsErrNotFound(err) {
			return Error(err)
		}
		// 文件不存在
		return Error(fmt.Errorf("未找到可同步的数据源"))
	}
	// 文件存在
	remote_last_operation_time_byte, err := client.Read(remote_last_operation_time_filepath)
	if err != nil {
		return Error(err)
	}
	remote_last_operation_time := string(remote_last_operation_time_byte)
	remote_millis, err := strconv.ParseInt(remote_last_operation_time, 10, 64)
	if err != nil {
		return Error(err)
	}
	_remote_last_operation_time := time.Unix(0, remote_millis*int64(time.Millisecond))
	// _remote_last_operation_time, err := time.Parse("20060102", remote_last_operation_time)
	// 如果本地数据库，最新的记录时间在 webdav 之前，说明需要 同步到本地，而不能 同步到远端
	var records []map[string]interface{}
	result := s.Biz.DB.Table(table_name).Order("last_operation_time DESC").Find(&records)
	if result.Error != nil {
		return Error(fmt.Errorf("查询记录失败: %v", result.Error))
	}
	if len(records) != 0 {
		table_last_record := records[0]
		table_last_operation_time := table_last_record["last_operation_time"].(string)
		millis, err := strconv.ParseInt(table_last_operation_time, 10, 64)
		// _record_last_operation_time, err := time.Parse("20060102", table_last_operation_time)
		if err != nil {
			return Error(err)
		}
		_record_last_operation_time := time.Unix(0, millis*int64(time.Millisecond))
		if _record_last_operation_time.Before(_remote_last_operation_time) {
			return Ok(nil)
		}
	}

	entries, err := client.ReadDir(table_out_dir)
	if err != nil {
		fmt.Printf("读取目录失败: %v\n", err)
		// return
		return Error(err)
	}

	for _, entry := range entries {
		path := filepath.Join(table_out_dir, entry.Name())
		if entry.IsDir() {
			var latest_record models.PasteEvent
			day_start, day_end, err := get_day_timestamp_range(entry.Name())
			if err != nil {
				return Error(err)
			}
			if err := s.Biz.DB.Table(table_name).Where("last_operation_time >= ? AND last_operation_time <= ?", day_start, day_end).Order("last_operation_time DESC").First(&latest_record).Error; err != nil {
				return Error(err)
			}
			local_time_filename := "last_operation_time"
			local_time_filepath := filepath.Join(path, local_time_filename)
			// _, err = os.Stat(local_time_filepath)
			// if err != nil {
			// 	return nil
			// }
			content, err := os.ReadFile(local_time_filepath)
			if err != nil {
				return Error(err)
			}
			local_last_operation_time := string(content)
			local_millis, err := strconv.ParseInt(local_last_operation_time, 10, 64)
			// _local_last_operation_time, err := time.Parse("20060102", local_last_operation_time)
			_local_last_operation_time := time.Unix(0, local_millis*int64(time.Millisecond))
			if err != nil {
				return Error(err)
			}
			// _record_last_operation_time, err := time.Parse("20060102", latest_record.LastOperationTime)
			record_millis, err := strconv.ParseInt(latest_record.LastOperationTime, 10, 64)
			if err != nil {
				return Error(err)
			}
			_record_last_operation_time := time.Unix(0, record_millis*int64(time.Millisecond))
			if _record_last_operation_time.Before(_local_last_operation_time) {
				fmt.Println("need sync the whole data from here", entry.Name())
				fmt.Println("a", latest_record)
				fmt.Println("b", local_last_operation_time)
			}
			// if latest_record.LastOperationTime
		} else {
			// fmt.Printf("文件: %s (大小: %d bytes)\n", path, info.Size())
		}
	}

	// err := filepath.Walk(out_dir, func(path string, info os.FileInfo, err error) error {
	// 	fmt.Println(path, info.Name())

	// })

	// if err != nil {
	// 	fmt.Printf("遍历目录出错: %v\n", err)
	// }

	return Ok(nil)
}
