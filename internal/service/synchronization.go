package service

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
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
	Biz *biz.BizApp
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
		Text:  path.Join(s.Biz.Config.UserConfigDir, s.Biz.Config.UserConfigName),
	}}

	return Ok(map[string]interface{}{
		"fields": fields,
	})
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

type SynchronizeMessageType int

const (
	SynchronizeMessageSuccess SynchronizeMessageType = iota
	SynchronizeMessageError
)

type SynchronizeTaskType int

const (
	SynchronizeTaskCreateFile SynchronizeTaskType = iota
	SynchronizeTaskCreateRecord
)

type SynchronizeMessage struct {
	Type  SynchronizeMessageType `json:"type"`
	Scope string                 `json:"scope"`
	Text  string                 `json:"text"`
}
type SynchronizeTask struct {
	Type    SynchronizeMessageType `json:"type"`
	Files   []*FileTask
	Records []*RecordTask
}

type RecordTask struct {
	Type string                 `json:"type"` // "create" "update" "delete"
	Id   string                 `json:"id,omitempty"`
	Data map[string]interface{} `json:"data"`
}
type FileTask struct {
	Type     string `json:"type"` // "new_file" "insert_line" "delete_line" "update_line"
	Name     string `json:"name,omitempty"`
	Filepath string `json:"filepath,omitempty"`
	Content  string `json:"content,omitempty"`
	Line     int    `json:"line,omitempty"`
}

type SynchronizeResult struct {
	Logs           []string              `json:"logs"`
	Messages       []*SynchronizeMessage `json:"messages"`
	FileTasks      []*FileTask           `json:"file_tasks"`
	FileOperations []*FileOperation      `json:"file_operations"`
	RecordTasks    []*RecordTask         `json:"record_tasks"`
}

type FileOperation struct {
	Type     string `json:"type"`
	Filepath string `json:"filepath"`
	Content  string `json:"content"`
}

func build_file_operations_from_file_tasks(tasks []*FileTask) []*FileOperation {
	// 按文件路径分组
	file_groups := make(map[string][]*FileTask)
	for _, task := range tasks {
		file_groups[task.Filepath] = append(file_groups[task.Filepath], task)
	}

	var result []*FileOperation
	// 先聚合对一个文件的所有操作
	for _, tasks := range file_groups {
		// 检查是否有new_file操作
		var has_new_file bool
		var new_file_task *FileTask
		var file_ops []*FileTask

		for _, task := range tasks {
			if task.Type == "new_file" {
				has_new_file = true
				new_file_task = task
			} else {
				file_ops = append(file_ops, task)
			}
		}

		if has_new_file {
			// 如果有new_file，则合并所有操作到content中
			// content := ""
			lines := []string{}
			// lines := strings.Split(content, "\n")

			// 处理所有针对该文件的操作
			for _, op := range file_ops {
				switch op.Type {
				case "insert_line":
					lines = append(lines, op.Content)
					// if op.Line <= len(lines)+1 {
					// 	// 插入行
					// 	lines = append(lines[:op.Line-1], append([]string{op.Content}, lines[op.Line-1:]...)...)
					// }
					// case "delete_line":
					// 	if op.Line <= len(lines) && op.Line > 0 {
					// 		lines = append(lines[:op.Line-1], lines[op.Line:]...)
					// 	}
					// case "update_line":
					// 	if op.Line <= len(lines) && op.Line > 0 {
					// 		lines[op.Line-1] = op.Content
					// 	}
				}
			}

			// 更新new_file的content
			result = append(result, &FileOperation{
				Type:     "new_file",
				Filepath: new_file_task.Filepath,
				Content:  strings.Join(lines, "\n"),
			})
		} else {
			// 没有new_file，需要合并相同行的操作
			line_ops := make(map[int][]*FileTask)

			// 按行号分组
			for _, op := range file_ops {
				if op.Line > 0 { // 确保是有行号的操作
					line_ops[op.Line] = append(line_ops[op.Line], op)
				}
			}

			// 对每行的操作，只保留最后一个有效的操作
			processed_ops := make(map[int]*FileTask)
			for line, ops := range line_ops {
				// 按时间顺序处理（假设tasks是按时间顺序的）
				var last_op *FileTask
				for _, op := range ops {
					switch op.Type {
					case "insert_line", "update_line":
						last_op = op
					case "delete_line":
						last_op = op
						// delete_line后不需要再处理该行的其他操作
						break
					}
				}
				processed_ops[line] = last_op
			}

			// 生成最终操作列表
			for _, op := range processed_ops {
				result = append(result, &FileOperation{
					Type:     "update_file",
					Filepath: op.Filepath,
					Content:  op.Content,
				})
			}
		}
	}

	return result
}

func build_local_sync_to_remote_tasks(table_name string, root_dir string, db *gorm.DB, client *gowebdav.Client) *SynchronizeResult {
	result := SynchronizeResult{
		FileTasks:   []*FileTask{},
		RecordTasks: []*RecordTask{},
		Messages:    []*SynchronizeMessage{},
		Logs:        []string{},
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	add_message := func(msg *SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	add_file_task := func(task *FileTask) {
		result.FileTasks = append(result.FileTasks, task)
	}
	// add_record_task := func(task *RecordTask) {
	// 	result.RecordTasks = append(result.RecordTasks, task)
	// }
	table_out_dir := path.Join(root_dir, table_name)
	remote_last_operation_time_filename := "meta"
	remote_meta_filepath := path.Join(table_out_dir, remote_last_operation_time_filename)
	var records []map[string]interface{}
	log("[LOG]before find latest record")
	if err := db.Table(table_name).Order("last_operation_time DESC").Limit(1).Find(&records).Error; err != nil {
		log("[ERROR]search latest record of table failed, because " + err.Error())
		add_message(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "database",
			Text:  err.Error(),
		})
		return &result
	}
	// root := &FileNode{
	// 	Name:  out_dir,
	// 	Type:  "folder",
	// 	Files: []*FileNode{},
	// }
	if len(records) == 0 {
		log("[LOG]the table don't have any records, don't synchronize to remote server")
		add_message(&SynchronizeMessage{
			Type:  SynchronizeMessageSuccess,
			Scope: "database",
			Text:  "there's no records need to be synchronized.",
		})
		return &result
	}
	// var files []*FileTask
	table_last_record := records[0]
	table_last_operation_time := table_last_record["last_operation_time"].(string)
	_record_last_operation_time, err := timestamp_to_time(table_last_operation_time)
	log("[LOG]the latest record in table is " + table_last_operation_time)
	if err != nil {
		log("[ERROR]format latest_operation_time failed, because " + err.Error())
		add_message(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "database",
			Text:  err.Error(),
		})
		return &result
		// return Error(err)
	}
	_, err = client.Stat(remote_meta_filepath)
	if err != nil {
		log("[ERROR]check remote server failed " + err.Error())
		if !gowebdav.IsErrNotFound(err) {
			// return Error(err)
			add_message(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "webdav",
				Text:  err.Error(),
			})
			return &result
		}
		// 文件不存在
		add_file_task(&FileTask{
			Type:     "new_file",
			Name:     remote_last_operation_time_filename,
			Filepath: remote_meta_filepath,
		})
		add_file_task(&FileTask{
			Type:     "insert_line",
			Filepath: remote_meta_filepath,
			Line:     1,
			Content:  table_last_operation_time,
		})
	} else {
		// 文件存在
		add_file_task(&FileTask{
			Type:     "update_line",
			Filepath: remote_meta_filepath,
			Line:     1,
			Content:  table_last_operation_time,
		})
		remote_meta_byte, err := client.Read(remote_meta_filepath)
		if err != nil {
			log("[ERROR]read the latest_operation_time file in remote server failed, because" + err.Error())
			add_message(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "webdav",
				Text:  err.Error(),
			})
			return &result
		}
		remote_meta_content := string(remote_meta_byte)
		// 将内容按行分割
		scanner := bufio.NewScanner(bytes.NewReader(remote_meta_byte))
		var lines []string
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		if len(lines) != 0 {
			// 替换指定行
			// lines[lineNumber-1] = newContent
			remote_latest_operation_time_str := lines[0]
			// remote_millis, err := strconv.ParseInt(remote_latest_operation_time_str, 10, 64)
			_remote_last_operation_time, err := timestamp_to_time(remote_latest_operation_time_str)
			if err != nil {
				log("[ERROR]format latest_operation_time failed" + err.Error())
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "format time",
					Text:  err.Error() + "[]" + remote_meta_content,
				})
				return &result
				// return Error(err)
			}
			// 如果本地数据库，最新的记录时间在 webdav 之前，说明需要 同步到本地，而不能 同步到远端
			log("[LOG]compare the latest_operation_time, local:" + table_last_operation_time + ", remote:" + remote_meta_content)
			if _record_last_operation_time.Before(_remote_last_operation_time) {
				log("[LOG]need pull latest records from remote server")
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageSuccess,
					Scope: "result",
					Text:  "Please pull the remote records to local.",
				})
				return &result
			}
		}
	}
	// 按天分组记录
	var dates []string
	db.Table(table_name).
		Select("strftime('%Y-%m-%d', created_at) as date").
		Group("date").
		Pluck("date", &dates)
	// day_groups := make(map[string][]map[string]interface{})
	// for _, record := range records {
	// 	created_at, ok := record["created_at"].(time.Time)
	// 	if !ok {
	// 		continue
	// 	}
	// 	day_key := created_at.Format("20060102") // 格式化为 YYYYMMDD
	// 	day_groups[day_key] = append(day_groups[day_key], record)
	// }
	// idx := 0
	log("[LOG]before walk dates " + strconv.Itoa(len(dates)))
	for _, day := range dates {
		log("[LOG]walk unique_day " + "[" + day + "]")
		// 解析时间（带时区）
		// day_time, err := time.Parse(time.RFC3339Nano, day)
		// if err != nil {
		// 	log("[ERROR]parse day failed, because " + err.Error())
		// 	continue
		// }
		// day_text := day_time.Format("2006-01-02")
		day_text := day
		day_dir := path.Join(table_out_dir, day_text)
		// if err := os.MkdirAll(day_dir, 0755); err != nil {
		// 	return Error(fmt.Errorf("创建日期目录失败: %v", err))
		// }
		var day_records []map[string]interface{}
		if err := db.Table(table_name).Where("date(created_at) = ?", day_text).Order("last_operation_time DESC").Find(&day_records).Error; err != nil {
			log("[ERROR]search latest record of table failed, because " + err.Error())
			add_message(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "database",
				Text:  err.Error(),
			})
			return &result
		}

		log("[LOG]the records count is " + strconv.Itoa(len(day_records)))
		_, ok := lo.Find(result.FileTasks, func(v *FileTask) bool {
			return v.Filepath == day_dir
		})
		if !ok {
			day_folder_task := &FileTask{
				Type:     "new_file",
				Name:     day,
				Filepath: day_dir,
			}
			log("[LOG]need create day file: " + day_folder_task.Filepath)
			add_file_task(day_folder_task)
		}

		var _day_last_operation_time time.Time
		for _, record := range day_records {
			log("[LOG]walk the records in day")
			// 将记录转为JSON
			record_json, err := json.Marshal(record)
			if err != nil {
				log("[ERROR]stringify record to JSON failed, because" + err.Error())
				// return Error(fmt.Errorf("JSON序列化失败: %v", err))
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "JSON Marshal",
					Text:  err.Error(),
				})
				continue
			}
			// 获取最后修改时间
			_last_operation_time, ok := record["last_operation_time"].(time.Time)
			if !ok {
				_last_operation_time = time.Now()
			}
			if _last_operation_time.After(_day_last_operation_time) {
				_day_last_operation_time = _last_operation_time
			}
			// uid := fmt.Sprintf("%v", record["id"])
			// last_operation_time := fmt.Sprintf("%d", _last_operation_time.Unix())
			// last_operation_time := strconv.FormatInt(_last_operation_time.UnixMilli(), 10)
			// last_operation_type := fmt.Sprintf("%d", record["last_operation_type"])
			// record_filepath := path.Join(day_dir, uid)
			// add_file_task(&FileTask{
			// 	Type:     "insert_line",
			// 	Name:     uid,
			// 	Filepath: record_filepath,
			// 	Files:    []*FileTask{},
			// })
			// if err := os.MkdirAll(record_filepath, 0755); err != nil {
			// 	return Error(fmt.Errorf("创建数据目录失败: %v", err))
			// }
			// data_filename := "data"
			// data_filepath := path.Join(record_filepath, data_filename)
			add_file_task(&FileTask{
				Type:     "insert_line",
				Filepath: day_dir,
				Content:  string(record_json),
			})
			// if err := os.WriteFile(data_filepath, record_json, 0644); err != nil {
			// 	return Error(fmt.Errorf("写入数据文件失败: %v", err))
			// }

			// last_operation_time_filename := "last_operation_time"
			// last_time_filepath := path.Join(record_filepath, last_operation_time_filename)
			// add_file_task(&FileTask{
			// 	Name:     last_operation_time_filename,
			// 	Filepath: last_time_filepath,
			// 	Type:     "file",
			// 	Content:  last_operation_time,
			// })
			// if err := os.WriteFile(last_time_filepath, []byte(last_operation_time), 0644); err != nil {
			// 	return Error(fmt.Errorf("写入操作时间文件失败: %v", err))
			// }
			// last_operation_type_filename := "last_operation_type"
			// last_type_filepath := path.Join(record_filepath, last_operation_type_filename)
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

		// day_last_operation_time_filename := "last_operation_time"
		// day_last_time_filepath := path.Join(day_dir, day_last_operation_time_filename)
		day_last_operation_time := strconv.FormatInt(_day_last_operation_time.UnixMilli(), 10)
		add_file_task(&FileTask{
			Type:     "insert_line",
			Filepath: day_dir,
			Content:  day_last_operation_time,
		})
	}
	result.FileOperations = build_file_operations_from_file_tasks(result.FileTasks)
	return &result
}
func local_sync_to_remote(table_name string, root_dir string, db *gorm.DB, client *gowebdav.Client) *SynchronizeResult {
	result := build_local_sync_to_remote_tasks(table_name, root_dir, db, client)

	add_message := func(msg *SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}

	for _, file := range result.FileOperations {
		if file.Type == "new_file" {
			data := []byte(file.Content)
			// 写入文件
			if err := client.Write(file.Filepath, data, 0644); err != nil {
				// return Error(fmt.Errorf("写入文件失败: %v", err))
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageSuccess,
					Scope: "webdav",
					Text:  err.Error(),
				})
				continue
			}
		}
	}

	return result
}

type WebDavSyncConfigBody struct {
	URL      string `json:"url"`
	RootDir  string `json:"root_dir"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *SyncService) LocalToRemoteTasks(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	tables := []string{"paste_event", "category_node", "category_hierarchy", "paste_event_category_mapping"}
	results := make(map[string]*SynchronizeResult)
	for _, t := range tables {
		r := build_local_sync_to_remote_tasks(t, body.RootDir, s.Biz.DB, client)
		results[t] = r
	}
	return Ok(results)
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

func get_day_timestamp_range(date_str string) (start_time, end_time int64, err error) {
	// 解析日期字符串
	date, err := time.Parse("2006-01-02", date_str)
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
func timestamp_to_time(timestamp string) (time.Time, error) {
	if match, _ := regexp.MatchString(`^[0-9]{1,}`, timestamp); !match {
		return time.Time{}, errors.New("not a valid timestamp")
	}
	millis, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return time.Time{}, err
	}
	r := time.Unix(0, millis*int64(time.Millisecond))
	// _remote_last_operation_time, err := time.Parse("20060102", remote_last_operation_time)
	return r, nil
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

func build_remote_sync_to_local_tasks(table_name string, root_dir string, db *gorm.DB, client *gowebdav.Client) *SynchronizeResult {
	result := SynchronizeResult{
		Logs:        []string{},
		Messages:    []*SynchronizeMessage{},
		RecordTasks: []*RecordTask{},
	}
	// var record_tasks []*RecordTask

	add_message := func(msg *SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	add_record_task := func(task *RecordTask) {
		result.RecordTasks = append(result.RecordTasks, task)
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}

	table_dir := path.Join(root_dir, table_name)
	remote_table_meta_file_path := path.Join(table_dir, "meta")
	_, err := client.Stat(remote_table_meta_file_path)
	if err != nil {
		if !gowebdav.IsErrNotFound(err) {
			log("[ERROR]find meta file failed, because " + remote_table_meta_file_path)
			add_message(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "webdav",
				Text:  err.Error(),
			})
			return &result
		}
		log("[ERROR]the meta file not existing, " + remote_table_meta_file_path)
		// 文件不存在
		add_message(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "webdav",
			Text:  "未找到可同步的数据源",
		})
		return &result
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
	var records []map[string]interface{}
	r := db.Table(table_name).Order("last_operation_time DESC").Limit(1).Find(&records)
	if r.Error != nil {
		log("[ERROR]find the latest record from local data failed, because " + remote_table_meta_file_path)
		add_message(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "database",
			Text:  r.Error.Error(),
		})
		return &result
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

	entries, err := client.ReadDir(table_dir)
	if err != nil {
		log("[ERROR]read dir " + table_dir + " failed, because " + err.Error())
		add_message(&SynchronizeMessage{
			Type: SynchronizeMessageError,
			Text: err.Error(),
		})
		return &result
	}

	for _, remote_day_file := range entries {
		nn := remote_day_file.Name()
		// is_day_file :=
		if match, _ := regexp.MatchString(`^[0-9]{4}-[0-9]{2}-[0-9]{2}`, nn); !match {
			continue
		}
		remote_day_folder_path := path.Join(table_dir, nn)
		if !remote_day_file.IsDir() {
			log("[LOG]walk day file content of " + remote_day_folder_path)
			day_start, day_end, err := get_day_timestamp_range(remote_day_file.Name())
			if err != nil {
				log("[ERROR]parse day_file failed, because " + err.Error())
				continue
			}
			var latest_records []map[string]interface{}
			if err := db.Table(table_name).Where("last_operation_time >= ? AND last_operation_time <= ?", day_start, day_end).Order("last_operation_time DESC").Limit(1).Find(&latest_records).Error; err != nil {
				log("[ERROR]find latest record failed, because " + err.Error())
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "database",
					Text:  err.Error(),
				})
				continue
			}
			// 远端存在文件，但本地没有找到记录，说明整个文件内的记录都是新增的
			remote_records_byte, err := client.Read(remote_day_folder_path)
			if err != nil {
				log("[ERROR]read day file failed, because " + err.Error())
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "webdav",
					Text:  err.Error(),
				})
				continue
			}
			// 将内容按行分割
			scanner := bufio.NewScanner(bytes.NewReader(remote_records_byte))
			var lines []string
			for scanner.Scan() {
				lines = append(lines, scanner.Text())
			}
			if len(lines) == 0 {
				log("[ERROR]the file " + remote_day_folder_path + " content is empty?")
				continue
			}
			if len(latest_records) == 0 {
				for _, line := range lines {
					// id := remote_record.Name()
					// remote_record_file_path := path.Join(remote_day_folder_path, id)
					// remote_record_data_file_path := path.Join(remote_record_file_path, "data")
					// fmt.Println("0", remote_record_data_file_path)
					// remote_record_byte, err := client.Read(remote_record_data_file_path)
					if match, _ := regexp.MatchString(`^[0-9]{1,}`, line); match {
						continue
					}
					var rr map[string]interface{}
					if err := json.Unmarshal([]byte(line), &rr); err != nil {
						log("[ERROR]parse the record JSON failed, because " + err.Error())
						continue
					}
					log("[LOG]the record need to create" + rr["id"].(string))
					add_record_task(&RecordTask{
						Type: "create",
						Data: rr,
					})
				}
				continue
			}
			// @todo 还是要恢复，用于高效跳过不必要的检查
			// latest_record := latest_records[0]
			// // 检查该天远端最新修改时间，和本地该天范围内的最新记录修改时间
			// remote_record_lot_str := lines[len(lines)-1]
			// remote_record_last_operation_time, err := timestamp_to_time(remote_record_lot_str)
			// if err != nil {
			// 	log("[ERROR]remote record, parse time failed, because " + err.Error())
			// 	add_message(&SynchronizeMessage{
			// 		Type:  SynchronizeMessageError,
			// 		Scope: "format time",
			// 		Text:  err.Error(),
			// 	})
			// 	continue
			// }
			// local_record_last_operation_time, err := timestamp_to_time(latest_record["last_operation_time"].(string))
			// if err != nil {
			// 	log("[ERROR]local record, parse time failed, because " + err.Error())
			// 	add_message(&SynchronizeMessage{
			// 		Type:  SynchronizeMessageError,
			// 		Scope: "format time",
			// 		Text:  err.Error(),
			// 	})
			// 	continue
			// }
			// log("[LOG]compare the latest operation time of special day")
			// if local_record_last_operation_time.Before(remote_record_last_operation_time) {
			// }
			for _, line := range lines {
				// id := remote_record_folder.Name()
				// remote_record_folder_path := path.Join(remote_day_folder_path, id)
				if match, _ := regexp.MatchString(`^[0-9]{1,}`, line); match {
					continue
				}
				var rr map[string]interface{}
				if err := json.Unmarshal([]byte(line), &rr); err != nil {
					log("[ERROR]parse the record JSON failed, because " + err.Error())
					continue
				}
				id, ok := rr["id"].(string)
				if !ok {
					log("[ERROR]get id failed")
					continue
				}
				var local_records []map[string]interface{}
				if err := db.Table(table_name).Where("id = ?", id).Limit(1).Find(&local_records).Error; err != nil {
					log("[ERROR]find the record with id failed, because " + err.Error())
					add_message(&SynchronizeMessage{
						Type:  SynchronizeMessageError,
						Scope: "database",
						Text:  err.Error(),
					})
					continue
				}
				if len(local_records) == 0 {
					log("[LOG]find a record need to create " + rr["id"].(string))
					// 远端存在文件但本地没有对应记录，说明文件是 新增
					add_record_task(&RecordTask{
						Type: "create",
						Data: rr,
					})
					continue
				}
				// 有匹配的记录，说明需要处理冲突，以最新的记录为准
				// remote_record_lot_file_path := path.Join(remote_record_folder_path, "last_operation_time")
				// fmt.Println("2", remote_record_lot_file_path)
				// remote_record_lot_byte, err := client.Read(remote_record_lot_file_path)
				// if err != nil {
				// 	add_message(&SynchronizeMessage{
				// 		Type:  SynchronizeMessageError,
				// 		Scope: "webdav",
				// 		Text:  r.Error.Error(),
				// 	})
				// 	continue
				// }
				remote_record_lot_content, ok := (rr["last_operation_time"]).(string)
				if !ok {
					log("[ERROR]get latest operation time failed, " + line)
					continue
				}
				local_record := local_records[0]
				local_record_lot_content := local_record["last_operation_time"].(string)
				if remote_record_lot_content == local_record_lot_content {
					log("[LOG]the last operation time is same")
					continue
				}
				remote_record_last_operation_time, err := timestamp_to_time(local_record_lot_content)
				if err != nil {
					log("[ERROR]parse remote time failed, because " + err.Error())
					add_message(&SynchronizeMessage{
						Type:  SynchronizeMessageError,
						Scope: "format time",
						Text:  err.Error(),
					})
					continue
				}
				local_record_last_operation_time, err := timestamp_to_time(remote_record_lot_content)
				if err != nil {
					log("[ERROR]parse local time failed, because " + err.Error())
					add_message(&SynchronizeMessage{
						Type:  SynchronizeMessageError,
						Scope: "format time",
						Text:  err.Error(),
					})
					continue
				}
				no_need_update := remote_record_last_operation_time.Before(local_record_last_operation_time)
				log("[LOG]check the record need to update t1:" + local_record_lot_content + " t2:" + remote_record_lot_content)
				if no_need_update {
					log("[ERROR]the records is latest, ignore the remote file")
					continue
				}
				// remote_record_data_file_path := path.Join(remote_record_folder_path, "data")
				// fmt.Println("3", remote_record_data_file_path)
				// remote_record_data_byte, err := client.Read(remote_record_data_file_path)
				// if err != nil {
				// 	add_message(&SynchronizeMessage{
				// 		Type:  SynchronizeMessageError,
				// 		Scope: "webdav",
				// 		Text:  r.Error.Error(),
				// 	})
				// 	continue
				// }
				log("[LOG]find a record need to update " + rr["id"].(string))
				add_record_task(&RecordTask{
					Type: "update",
					Id:   id,
					Data: rr,
				})
			}
		}
	}

	return &result
}

func remote_sync_to_local(table_name string, root_dir string, db *gorm.DB, client *gowebdav.Client) *SynchronizeResult {
	result := build_remote_sync_to_local_tasks(table_name, root_dir, db, client)

	add_message := func(msg *SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}

	for _, r := range result.RecordTasks {
		// var d map[string]interface{}
		// if err := json.Unmarshal([]byte(r.Content), &d); err != nil {
		// 	continue
		// }
		log("[LOG]" + r.Type)
		if r.Type == "create" {
			if err := db.Table(table_name).Create(r.Data); err != nil {
				continue
			}
		}
		if r.Type == "update" {
			r := db.Table(table_name).Where("id = ?", r.Id).Updates(r.Data)
			if r.Error != nil {
				log("[ERROR]update record failed, because " + r.Error.Error())
				// errors = append(errors, fmt.Errorf("更新记录失败: %v", result.Error))
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "database",
					Text:  r.Error.Error(),
				})
				continue
			}
			if r.RowsAffected == 0 {
				log("[ERROR]update record failed, no matched record.")
				// errors = append(errors, fmt.Errorf("未找到要更新的记录ID: %s", r.Id))
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "database",
					Text:  "",
				})
				continue
			}
			log("[ERROR]update record success, affected rows " + strconv.Itoa(int(r.RowsAffected)))
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
	return result
}

func (s *SyncService) RemoteToLocalTask(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	tables := []string{"paste_event", "category_node", "category_hierarchy", "paste_event_category_mapping"}
	results := make(map[string]*SynchronizeResult)
	for _, t := range tables {
		r := build_remote_sync_to_local_tasks(t, body.RootDir, s.Biz.DB, client)
		results[t] = r
	}
	return Ok(results)
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
