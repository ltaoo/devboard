package synchronizer

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
)

type RemoteStorage struct {
}

type Synchronizer struct {
}

func (s *Synchronizer) PushToRemote(table_name string) {

}

func (s *Synchronizer) PullFromRemote(table_name string) {

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

type DayFileMeta struct {
	Name              string `json:"name"`
	Idx               int    `json:"idx"`
	LastOperationTime string `json:"last_operation_time"`
}

type RecordTask struct {
	Type string                 `json:"type"` // "create" "update" "delete"
	Id   string                 `json:"id,omitempty"`
	Data map[string]interface{} `json:"data"`
}
type FileTask struct {
	Type     string `json:"type"` // "new_file" "update_file" "append_line" "delete_line" "update_line"
	Filepath string `json:"filepath,omitempty"`
	Content  string `json:"content,omitempty"` // new_file 时为空，update_file 时为原始内容
	Line     int    `json:"line"`
}
type FileOperation struct {
	Type     string `json:"type"` // "new_file" | "update_file"
	Filepath string `json:"filepath"`
	Content  string `json:"content"`
}

type SynchronizeResult struct {
	Logs           []string              `json:"logs"`
	Messages       []*SynchronizeMessage `json:"messages"`
	FileTasks      []*FileTask           `json:"file_tasks"`
	FileOperations []*FileOperation      `json:"file_operations"`
	RecordTasks    []*RecordTask         `json:"record_tasks"`
}

func SplitToLines(data []byte) []string {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	var lines []string
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines
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

func BuildLocalSyncToRemoteTasks(table_name string, root_dir string, local_client LocalClient, remote_client RemoteClient) *SynchronizeResult {
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
	local_last_record, err := local_client.FetchTableLastRecord()
	if err != nil {
		log("[ERROR]" + err.Error())
		add_message(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "database",
			Text:  err.Error(),
		})
		return &result
	}
	local_table_lot_str, ok := local_last_record["last_operation_time"].(string)
	if !ok {
		log("[LOG]parse last record's last_operation_time failed")
		return &result
	}
	table_lot_time, err := timestamp_to_time(local_table_lot_str)
	// log("[LOG]the latest record in table is " + table_last_operation_time)
	if err != nil {
		log("[ERROR]format latest_operation_time failed, because " + err.Error())
		add_message(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "database",
			Text:  err.Error(),
		})
		return &result
	}
	var file_meta_list []*DayFileMeta
	table_out_dir := path.Join(root_dir, table_name)
	remote_table_meta_filepath := path.Join(table_out_dir, "meta")
	_, err = remote_client.Stat(remote_table_meta_filepath)
	if err != nil {
		log("[ERROR]check remote server failed " + err.Error())
		if !remote_client.IsErrNotFound(err) {
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
			Filepath: remote_table_meta_filepath,
		})
		add_file_task(&FileTask{
			Type:     "append_line",
			Filepath: remote_table_meta_filepath,
			Content:  local_table_lot_str,
		})
	} else {
		// 文件存在
		remote_meta_byte, err := remote_client.Read(remote_table_meta_filepath)
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
		add_file_task(&FileTask{
			Type:     "update_file",
			Filepath: remote_table_meta_filepath,
			Content:  remote_meta_content,
		})
		lines := SplitToLines(remote_meta_byte)
		if len(lines) != 0 {
			remote_table_lot_str := lines[0]
			log("[LOG]check need update the table, v1:" + remote_table_lot_str + " v2:" + local_table_lot_str)
			if remote_table_lot_str == local_table_lot_str {
				return &result
			}
			remote_lot_time, err := timestamp_to_time(remote_table_lot_str)
			if err != nil {
				log("[ERROR]parse last time in meta failed, because" + err.Error())
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "format time",
					Text:  err.Error() + "[]" + remote_meta_content,
				})
				return &result
			}
			// 如果本地数据库，最新的记录时间在 remote 之前，说明需要 先将数据从远端同步到本地，而不能 同步到远端，避免覆盖新的内容
			log("[LOG]table - compare the latest_operation_time, local:" + local_table_lot_str + ", remote:" + remote_meta_content)
			if table_lot_time.Before(remote_lot_time) {
				log("[LOG]need pull latest records from remote server")
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageSuccess,
					Scope: "result",
					Text:  "Please pull the remote records to local.",
				})
				return &result
			}
			add_file_task(&FileTask{
				Type:     "update_line",
				Filepath: remote_table_meta_filepath,
				Line:     0,
				Content:  local_table_lot_str,
			})
			for idx, line := range lines[1:] {
				regex := regexp.MustCompile(`^([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{1,})`)
				matched := regex.FindStringSubmatch(line)
				if len(matched) == 3 {
					file_meta_list = append(file_meta_list, &DayFileMeta{
						Name:              matched[1],
						Idx:               idx,
						LastOperationTime: matched[2],
					})
				}
			}
		}
	}
	dates := local_client.FetchUniqueDaysOfTable()
	log("[LOG]before walk dates " + strconv.Itoa(len(dates)))
	for _, day := range dates {
		log("[LOG]walk unique_day " + "[" + day + "]")
		day_text := day
		day_file_path := path.Join(table_out_dir, day_text)
		day_records, err := local_client.FetchRecordsBetweenSpecialDayOfTable(day_text)
		if err != nil {
			log("[ERROR]search latest record of table failed, because " + err.Error())
			add_message(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "database",
				Text:  err.Error(),
			})
			continue
		}
		if len(day_records) == 0 {
			log("[LOG]there is no records")
			continue
		}
		log("[LOG]the records count is " + strconv.Itoa(len(day_records)))
		local_lot_str, ok := day_records[0]["last_operation_time"].(string)
		if !ok {
			continue
		}
		var existing_day_meta *DayFileMeta
		for _, v := range file_meta_list {
			if v.Name == day {
				existing_day_meta = v
			}
		}
		if existing_day_meta == nil {
			add_file_task(&FileTask{
				Type:     "append_line",
				Filepath: remote_table_meta_filepath,
				Content:  day + " " + local_lot_str,
			})
		} else {
			log("[LOG]check need update day line in meta file, v1:" + local_lot_str + " v2:" + existing_day_meta.LastOperationTime)
			if local_lot_str == existing_day_meta.LastOperationTime {
				continue
			}
			// local_lot_time, err := timestamp_to_time(local_lot_str)
			// if err != nil {
			// 	log("[ERROR]parse local lot time failed " + local_lot_str)
			// 	continue
			// }
			// remote_lot_time, err := timestamp_to_time(existing_day_meta.LastOperationTime)
			// if err != nil {
			// 	log("[ERROR]parse remote lot time failed " + local_lot_str)
			// 	continue
			// }
			// if local_lot_time.Before(remote_lot_time) { }
			add_file_task(&FileTask{
				Type:     "update_line",
				Filepath: remote_table_meta_filepath,
				Line:     existing_day_meta.Idx,
				Content:  day + " " + local_lot_str,
			})
		}
		file_task := &FileTask{
			Type:     "new_file",
			Filepath: day_file_path,
		}
		_, err = remote_client.Stat(day_file_path)
		if err != nil {
			if !remote_client.IsErrNotFound(err) {
				log("[ERROR]find day file failed " + err.Error())
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "webdav",
					Text:  err.Error(),
				})
				continue
			}
			log("[LOG]need create day file: " + day_file_path)
			add_file_task(file_task)
		} else {
			// day file is existing
			file_task.Type = "update_file"
			add_file_task(file_task)
		}
		var lines []string
		remote_day_file_byte, err := remote_client.Read(day_file_path)
		if err != nil {
			log("[ERROR]read day file failed, because " + err.Error())
			add_message(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "webdav",
				Text:  err.Error(),
			})
		} else {
			lines = SplitToLines(remote_day_file_byte)
		}
		log("[LOG]before walk the records in special day " + day)
		if file_task.Type == "update_file" {
			file_task.Content = string(remote_day_file_byte)
		}
		for _, record := range day_records {
			id, ok := record["id"].(string)
			if !ok {
				log("[ERROR]parse id failed")
				continue
			}
			// if file_task.Type == "new_file" {
			// 	continue
			// }
			// local_record_lot, ok := record["last_operation_time"].(time.Time)
			// if !ok {
			// 	log("[ERROR]parse local record last operation time failed")
			// 	continue
			// }
			matched_line_idx := -1
			for idx, line_text := range lines {
				if find := strings.Contains(line_text, `"`+id+`"`); find {
					matched_line_idx = idx
				}
			}
			if matched_line_idx != -1 {
				// 存在相同的记录
				matched_line := lines[matched_line_idx]
				var rr map[string]interface{}
				if err := json.Unmarshal([]byte(matched_line), &rr); err != nil {
					log("[ERROR]parse the record JSON failed, because " + err.Error())
					continue
				}
				if rr["id"] != id {
					log("[ERROR]the record id is not same")
					// 上面的查找失误了，可能是复制的内容包含 id，这里规避掉这种可能
					continue
				}
				if rr["last_operation_time"] != record["last_operation_time"] {
					record_byte, err := json.Marshal(record)
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
					log("[LOG]need to update a record " + id)
					add_file_task(&FileTask{
						Type:     "update_line",
						Filepath: day_file_path,
						Line:     matched_line_idx,
						Content:  string(record_byte),
					})
				}
			} else {
				record_byte, err := json.Marshal(record)
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
				log("[LOG]need to create a record " + id)
				add_file_task(&FileTask{
					Type:     "append_line",
					Filepath: day_file_path,
					Content:  string(record_byte),
				})
			}
		}
	}
	result.FileOperations = BuildFileOperationsFromFileTasks(result.FileTasks)
	return &result
}

func BuildRemoteSyncToLocalTasks(table_name string, root_dir string, local_client LocalClient, remote_client RemoteClient) *SynchronizeResult {
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
	_, err := remote_client.Stat(remote_table_meta_file_path)
	if err != nil {
		if !remote_client.IsErrNotFound(err) {
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
	// var records []map[string]interface{}
	// r := db.Table(table_name).Order("last_operation_time DESC").Limit(1).Find(&records)
	// record, err := local_client.FetchTableLastRecord()
	// if err != nil {
	// 	log("[ERROR]find the latest record from local data failed, because " + remote_table_meta_file_path)
	// 	add_message(&SynchronizeMessage{
	// 		Type:  SynchronizeMessageError,
	// 		Scope: "database",
	// 		Text:  err.Error(),
	// 	})
	// 	return &result
	// }
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

	entries, err := remote_client.ReadDir(table_dir)
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
			latest_records, err := local_client.FetchLastRecordBetweenStartAndEndOfTable(day_start, day_end)
			if err != nil {
				log("[ERROR]" + err.Error())
				add_message(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "database",
					Text:  err.Error(),
				})
				continue
			}
			// 远端存在文件，但本地没有找到记录，说明整个文件内的记录都是新增的
			remote_records_byte, err := remote_client.Read(remote_day_folder_path)
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
			lines := SplitToLines(remote_records_byte)
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
					log("[LOG]the record need to create")
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
				local_records, err := local_client.FetchRecordById(id)
				if err != nil {
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
