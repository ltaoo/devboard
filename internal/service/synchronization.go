package service

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/samber/lo"
	"github.com/studio-b12/gowebdav"
	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
)

type SyncService struct {
	App *application.App
	Biz *biz.App
}

type DatabaseField struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Text  string `json:"text"`
}

func (s *SyncService) FetchDatabaseDirs() *Result {
	fields := [...]DatabaseField{{
		Key:   "database_filepath",
		Label: "数据库",
		Text:  s.Biz.Config.DBPath,
	}, {
		Key:   "settings_filepath",
		Label: "用户配置",
		Text:  filepath.Join(s.Biz.Config.UserConfigDir, s.Biz.Config.UserConfigName),
	}}

	return Ok(map[string]interface{}{
		"fields": fields,
	})
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

func local_sync_to_remote(table_name string, root_dir string, db *gorm.DB, client *gowebdav.Client) *SynchronizeResult {
	result := SynchronizeResult{
		Messages: []SynchronizeMessage{},
	}

	table_out_dir := filepath.Join(root_dir, table_name)
	remote_last_operation_time_filename := "last_operation_time"
	remote_last_operation_time_filepath := filepath.Join(table_out_dir, remote_last_operation_time_filename)
	var records []map[string]interface{}
	r := db.Table(table_name).Order("last_operation_time DESC").Limit(1).Find(&records)
	if r.Error != nil {
		// return Error(fmt.Errorf("查询记录失败: %v", r.Error))
		result.Messages = append(result.Messages, SynchronizeMessage{
			Type:  1,
			Scope: "database",
			Text:  r.Error.Error(),
		})
		return &result
	}

	// root := &FileNode{
	// 	Name:  out_dir,
	// 	Type:  "folder",
	// 	Files: []*FileNode{},
	// }
	if len(records) == 0 {
		// return Ok(files)
		result.Messages = append(result.Messages, SynchronizeMessage{
			Type:  2,
			Scope: "database",
			Text:  "there's no records need to be synchronized.",
		})
		return &result
	}
	var files []*FileNode
	table_last_record := records[0]
	table_last_operation_time := table_last_record["last_operation_time"].(string)
	millis, err := strconv.ParseInt(table_last_operation_time, 10, 64)
	// _record_last_operation_time, err := time.Parse("20060102", table_last_operation_time)
	if err != nil {
		result.Messages = append(result.Messages, SynchronizeMessage{
			Type:  1,
			Scope: "database",
			Text:  err.Error(),
		})
		return &result
		// return Error(err)
	}
	_record_last_operation_time := time.Unix(0, millis*int64(time.Millisecond))
	_, err = client.Stat(remote_last_operation_time_filepath)
	if err != nil {
		if !gowebdav.IsErrNotFound(err) {
			// return Error(err)
			result.Messages = append(result.Messages, SynchronizeMessage{
				Type:  1,
				Scope: "webdav",
				Text:  err.Error(),
			})
			return &result
		}
		// 文件不存在
	} else {
		// 文件存在
		remote_last_operation_time_byte, err := client.Read(remote_last_operation_time_filepath)
		if err != nil {
			// return Error(err)
			result.Messages = append(result.Messages, SynchronizeMessage{
				Type:  1,
				Scope: "webdav",
				Text:  err.Error(),
			})
			return &result
		}
		remote_last_operation_time := string(remote_last_operation_time_byte)
		remote_millis, err := strconv.ParseInt(remote_last_operation_time, 10, 64)
		if err != nil {
			result.Messages = append(result.Messages, SynchronizeMessage{
				Type:  1,
				Scope: "format time",
				Text:  err.Error() + "[]" + remote_last_operation_time,
			})
			return &result
			// return Error(err)
		}
		_remote_last_operation_time := time.Unix(0, remote_millis*int64(time.Millisecond))
		// _remote_last_operation_time, err := time.Parse("20060102", remote_last_operation_time)
		// 如果本地数据库，最新的记录时间在 webdav 之前，说明需要 同步到本地，而不能 同步到远端
		if _record_last_operation_time.Before(_remote_last_operation_time) {
			// return Ok(nil)
			result.Messages = append(result.Messages, SynchronizeMessage{
				Type:  2,
				Scope: "result",
				Text:  "Please pull the remote records to local.",
			})
			return &result
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
				// return Error(fmt.Errorf("JSON序列化失败: %v", err))
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "JSON Marshal",
					Text:  err.Error(),
				})
				return &result
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
			// last_operation_type := fmt.Sprintf("%d", record["last_operation_type"])

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
			// last_operation_type_filename := "last_operation_type"
			// last_type_filepath := filepath.Join(record_filepath, last_operation_type_filename)
			// files = append(files, &FileNode{
			// 	Name:     last_operation_type_filename,
			// 	Filepath: last_type_filepath,
			// 	Type:     "file",
			// 	Content:  last_operation_type,
			// })
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
				// return Error(fmt.Errorf("创建目录失败: %v", err))
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "webdav",
					Text:  err.Error(),
				})
				continue
			}
			// if err := os.MkdirAll(file.Filepath, 0755); err != nil {
			// 	return Error(fmt.Errorf("创建目录失败: %v", err))
			// }
		}
		if file.Type == "file" {
			data := []byte(file.Content)
			// 写入文件
			if err := client.Write(file.Filepath, data, 0644); err != nil {
				// return Error(fmt.Errorf("写入文件失败: %v", err))
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "webdav",
					Text:  err.Error(),
				})
				continue
			}
			// if err := os.WriteFile(file.Filepath, []byte(file.Content), 0644); err != nil {
			// 	return Error(fmt.Errorf("写入文件失败: %v", err))
			// }
		}
	}

	return &result
}

type WebDavSyncConfigBody struct {
	URL      string `json:"url"`
	RootDir  string `json:"root_dir"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *SyncService) LocalToRemote(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	// root_dir := "/Users/mayfair/Documents/export_ttt"
	tables := []string{"paste_event", "category_node", "category_hierarchy", "paste_event_category_mapping"}
	var results []*SynchronizeResult
	for _, t := range tables {
		r := local_sync_to_remote(t, body.RootDir, s.Biz.DB, client)
		results = append(results, r)
	}
	return Ok(results)

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

type ActionsNeedApply struct {
	Action  int // 1新增 2编辑 3删除
	Id      string
	Content string
}

func WithTable(table string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Table(table)
	}
}

type SynchronizeMessage struct {
	Type  int    `json:"type"`
	Scope string `json:"scope"`
	Text  string `json:"text"`
}
type SynchronizeResult struct {
	Messages []SynchronizeMessage `json:"messages"`
}

func remote_sync_to_local(table_name string, root_dir string, db *gorm.DB, client *gowebdav.Client) *SynchronizeResult {
	result := SynchronizeResult{
		Messages: []SynchronizeMessage{},
	}

	// table_name := "paste_event"
	table_out_dir := filepath.Join(root_dir, table_name)
	remote_table_lot_file_path := filepath.Join(table_out_dir, "last_operation_time")
	fmt.Println("check existing the ", remote_table_lot_file_path)
	_, err := client.Stat(remote_table_lot_file_path)
	if err != nil {
		if !gowebdav.IsErrNotFound(err) {
			result.Messages = append(result.Messages, SynchronizeMessage{
				Type:  1,
				Scope: "webdav",
				Text:  err.Error(),
			})
			// return Error(err)
			return &result
		}
		// 文件不存在
		result.Messages = append(result.Messages, SynchronizeMessage{
			Type:  1,
			Scope: "webdav",
			Text:  "未找到可同步的数据源",
		})
		return &result
		// return Error(fmt.Errorf("未找到可同步的数据源"))
	}
	// 文件存在
	// remote_lot_byte, err := client.Read(remote_table_lot_file_path)
	// if err != nil {
	// 	return Error(err)
	// }
	// remote_millis, err := strconv.ParseInt(string(remote_lot_byte), 10, 64)
	// if err != nil {
	// 	return Error(err)
	// }
	// remote_last_operation_time := time.Unix(0, remote_millis*int64(time.Millisecond))
	// _remote_last_operation_time, err := time.Parse("20060102", remote_last_operation_time)
	// 如果本地数据库，最新的记录时间在 webdav 之前，说明需要 同步到本地，而不能 同步到远端
	var records []map[string]interface{}
	r := db.Table(table_name).Order("last_operation_time DESC").Limit(1).Find(&records)
	if r.Error != nil {
		result.Messages = append(result.Messages, SynchronizeMessage{
			Type:  1,
			Scope: "database",
			Text:  r.Error.Error(),
		})
		return &result
		// return Error(fmt.Errorf("查询记录失败: %v", result.Error))
	}
	// if len(records) != 0 {
	// 	local_record := records[0]
	// 	local_record_lot_content := local_record["last_operation_time"].(string)
	// 	local_millis, err := strconv.ParseInt(local_record_lot_content, 10, 64)
	// 	// _record_last_operation_time, err := time.Parse("20060102", table_last_operation_time)
	// 	if err != nil {
	// 		return Error(err)
	// 	}
	// 	local_last_operation_time := time.Unix(0, local_millis*int64(time.Millisecond))
	// 	if remote_last_operation_time.Before(local_last_operation_time) {
	// 		return Error(fmt.Errorf("本地记录晚于远端"))
	// 	}
	// }

	entries, err := client.ReadDir(table_out_dir)
	if err != nil {
		fmt.Printf("读取目录失败: %v\n", err)
		// return
		// return Error(err)
		result.Messages = append(result.Messages, SynchronizeMessage{
			Type: 1,
			Text: r.Error.Error(),
		})
		return &result
	}

	var records_prepare_apply []ActionsNeedApply

	for _, remote_day_folder := range entries {
		remote_day_folder_path := filepath.Join(table_out_dir, remote_day_folder.Name())
		if remote_day_folder.IsDir() {
			day_start, day_end, err := get_day_timestamp_range(remote_day_folder.Name())
			if err != nil {
				// return Error(err)
			}
			var latest_records []map[string]interface{}
			if err := db.Table(table_name).Where("last_operation_time >= ? AND last_operation_time <= ?", day_start, day_end).Order("last_operation_time DESC").Limit(1).Find(&latest_records).Error; err != nil {
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "database",
					Text:  r.Error.Error(),
				})
				// return Error(err)
				continue
			}
			if len(latest_records) == 0 {
				// 远端存在文件，但本地没有找到记录，说明整个文件夹内的文件都是新增的
				remote_records, err := client.ReadDir(remote_day_folder_path)
				if err != nil {
					fmt.Printf("读取目录失败: %v\n", err)
					result.Messages = append(result.Messages, SynchronizeMessage{
						Type:  1,
						Scope: "webdav",
						Text:  r.Error.Error(),
					})
					continue
					// return Error(err)
				}
				for _, remote_record := range remote_records {
					if remote_record.IsDir() {
						id := remote_record.Name()
						remote_record_file_path := filepath.Join(remote_day_folder_path, id)
						remote_record_data_file_path := filepath.Join(remote_record_file_path, "data")
						fmt.Println("0", remote_record_data_file_path)
						remote_record_byte, err := client.Read(remote_record_data_file_path)
						if err != nil {
							// return Error(err)
							result.Messages = append(result.Messages, SynchronizeMessage{
								Type:  1,
								Scope: "webdav",
								Text:  r.Error.Error(),
							})
							continue
						}
						records_prepare_apply = append(records_prepare_apply, ActionsNeedApply{
							Id:      id,
							Action:  1,
							Content: string(remote_record_byte),
						})
					}
				}
				continue
			}
			latest_record := latest_records[0]
			// 检查该天远端最新修改时间，和本地该天范围内的最新记录修改时间
			remote_record_lot_file_path := filepath.Join(remote_day_folder_path, "last_operation_time")
			remote_record_lot_byte, err := client.Read(remote_record_lot_file_path)
			if err != nil {
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "webdav",
					Text:  r.Error.Error(),
				})
				continue
				// return Error(err)
			}
			remote_record_lot_str := string(remote_record_lot_byte)
			remote_record_lot_millis, err := strconv.ParseInt(remote_record_lot_str, 10, 64)
			// remote_record_last_operation_time, err := time.Parse("20060102", local_last_operation_time)
			remote_record_last_operation_time := time.Unix(0, remote_record_lot_millis*int64(time.Millisecond))
			if err != nil {
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "format time",
					Text:  r.Error.Error(),
				})
				continue
				// return Error(err)
			}
			// _record_last_operation_time, err := time.Parse("20060102", latest_record.LastOperationTime)
			local_record_lot_millis, err := strconv.ParseInt(latest_record["last_operation_time"].(string), 10, 64)
			if err != nil {
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "format time",
					Text:  r.Error.Error(),
				})
				continue
				// return Error(err)
			}
			local_record_last_operation_time := time.Unix(0, local_record_lot_millis*int64(time.Millisecond))
			if local_record_last_operation_time.Before(remote_record_last_operation_time) {
				remote_record_list, err := client.ReadDir(remote_day_folder_path)
				if err != nil {
					fmt.Printf("读取目录失败: %v\n", err)
					result.Messages = append(result.Messages, SynchronizeMessage{
						Type:  1,
						Scope: "webdav",
						Text:  r.Error.Error(),
					})
					continue
					// return Error(err)
				}
				for _, remote_record_folder := range remote_record_list {
					if remote_record_folder.IsDir() {
						id := remote_record_folder.Name()
						remote_record_folder_path := filepath.Join(remote_day_folder_path, id)
						var local_records []map[string]interface{}
						if err := db.Table(table_name).Where("id = ?", id).Limit(1).Find(&local_records).Error; err != nil {
							result.Messages = append(result.Messages, SynchronizeMessage{
								Type:  1,
								Scope: "database",
								Text:  r.Error.Error(),
							})
							continue
							// return Error(err)
						}
						if len(local_records) == 0 {
							// 远端存在文件但本地没有对应记录，说明文件是 新增
							remote_record_data_file_path := filepath.Join(remote_record_folder_path, "data")
							fmt.Println("1", remote_record_data_file_path)
							remote_record_byte, err := client.Read(remote_record_data_file_path)
							if err != nil {
								result.Messages = append(result.Messages, SynchronizeMessage{
									Type:  1,
									Scope: "webdav",
									Text:  r.Error.Error(),
								})
								continue
								// return Error(err)
							}
							records_prepare_apply = append(records_prepare_apply, ActionsNeedApply{
								Id:      id,
								Action:  1,
								Content: string(remote_record_byte),
							})
							continue
						}
						// 有匹配的记录，说明需要处理冲突，以最新的记录为准
						remote_record_lot_file_path := filepath.Join(remote_record_folder_path, "last_operation_time")
						fmt.Println("2", remote_record_lot_file_path)
						remote_record_lot_byte, err := client.Read(remote_record_lot_file_path)
						if err != nil {
							result.Messages = append(result.Messages, SynchronizeMessage{
								Type:  1,
								Scope: "webdav",
								Text:  r.Error.Error(),
							})
							continue
							// return Error(err)
						}
						remote_record_lot_content := string(remote_record_lot_byte)
						remote_record_lot_millis, err := strconv.ParseInt(remote_record_lot_content, 10, 64)
						if err != nil {
							result.Messages = append(result.Messages, SynchronizeMessage{
								Type:  1,
								Scope: "format time",
								Text:  r.Error.Error(),
							})
							continue
							// return Error(err)
						}
						remote_record_last_operation_time := time.Unix(0, remote_record_lot_millis*int64(time.Millisecond))

						local_record := local_records[0]
						local_record_lot_content := local_record["last_operation_time"].(string)
						local_record_lot_millis, err := strconv.ParseInt(local_record_lot_content, 10, 64)
						if err != nil {
							result.Messages = append(result.Messages, SynchronizeMessage{
								Type:  1,
								Scope: "format time",
								Text:  r.Error.Error(),
							})
							continue
							// return Error(err)
						}
						local_record_last_operation_time := time.Unix(0, local_record_lot_millis*int64(time.Millisecond))
						if remote_record_last_operation_time.Before(local_record_last_operation_time) {
							continue
						}
						remote_record_data_file_path := filepath.Join(remote_record_folder_path, "data")
						fmt.Println("3", remote_record_data_file_path)
						remote_record_data_byte, err := client.Read(remote_record_data_file_path)
						if err != nil {
							result.Messages = append(result.Messages, SynchronizeMessage{
								Type:  1,
								Scope: "webdav",
								Text:  r.Error.Error(),
							})
							continue
							// return Error(err)
						}
						records_prepare_apply = append(records_prepare_apply, ActionsNeedApply{
							Id:      id,
							Action:  2,
							Content: string(remote_record_data_byte),
						})
					}
				}
			}
		}
	}

	// var errors []error

	for _, r := range records_prepare_apply {
		fmt.Println(r.Id, r.Action)
		var d map[string]interface{}
		if err := json.Unmarshal([]byte(r.Content), &d); err != nil {
			continue
		}
		if r.Action == 1 {
			if err := db.Table(table_name).Create(d); err != nil {
				continue
			}
		}
		if r.Action == 2 {
			r := db.Table(table_name).Where("id = ?", r.Id).Updates(d)
			if r.Error != nil {
				// errors = append(errors, fmt.Errorf("更新记录失败: %v", result.Error))
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "database",
					Text:  r.Error.Error(),
				})
				continue
			}
			if r.RowsAffected == 0 {
				// errors = append(errors, fmt.Errorf("未找到要更新的记录ID: %s", r.Id))
				result.Messages = append(result.Messages, SynchronizeMessage{
					Type:  1,
					Scope: "database",
					Text:  r.Error.Error(),
				})
			}
		}
		// if r.Action == 3 {
		// 	result := s.Biz.DB.Table(table_name).Where("id = ?", r.Id).Delete(nil)
		// 	if result.Error != nil {
		// 		return fmt.Errorf("删除记录失败: %v", result.Error)
		// 	}
		// 	if result.RowsAffected == 0 {
		// 		return fmt.Errorf("未找到要删除的记录ID: %s", action.Id)
		// 	}
		// }
	}

	return &result
}

func (s *SyncService) RemoteToLocal(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	tables := []string{"paste_event", "category_node", "category_hierarchy", "paste_event_category_mapping"}
	var results []*SynchronizeResult
	for _, t := range tables {
		r := remote_sync_to_local(t, body.RootDir, s.Biz.DB, client)
		results = append(results, r)
	}
	return Ok(results)
}
