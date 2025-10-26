package service

import (
	"path"
	"regexp"
	"strconv"
	"time"

	"github.com/studio-b12/gowebdav"
	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/pkg/synchronizer"
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

var tables = []synchronizer.TableSynchronizeSetting{{
	Name:        "paste_event",
	IdFieldName: "id",
}, {
	Name:        "category_node",
	IdFieldName: "id",
}, {
	Name:        "category_hierarchy",
	IdFieldName: "id",
}, {
	Name:        "paste_event_category_mapping",
	IdFieldName: "id",
}, {
	Name:        "remark",
	IdFieldName: "id",
}, {
	Name:        "device",
	IdFieldName: "id",
}, {
	Name:        "app",
	IdFieldName: "id",
}}

func local_to_remote(t synchronizer.TableSynchronizeSetting, root_dir string, db *gorm.DB, client *gowebdav.Client) *synchronizer.SynchronizeResult {
	table_name := t.Name
	local_client := synchronizer.NewDatabaseLocalClient(db, table_name)
	remote_client := synchronizer.NewWebdavClient(client)
	result := synchronizer.BuildLocalSyncToRemoteTasks(t, root_dir, local_client, remote_client)
	// add_message := func(msg *synchronizer.SynchronizeMessage) {
	// 	result.Messages = append(result.Messages, msg)
	// }
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	for _, file := range result.FileOperations {
		if file.Type == "new_file" {
			data := []byte(file.Content)
			if err := client.Write(file.Filepath, data, 0644); err != nil {
				log("[ERROR]write file failed, because " + err.Error())
				continue
			}
		}
		if file.Type == "update_file" {
			data := []byte(file.Content)
			if err := client.Write(file.Filepath, data, 0644); err != nil {
				log("[ERROR]update file failed, because " + err.Error())
				continue
			}
		}
	}
	for _, r := range result.RecordTasks {
		if r.Type == "update_sync_status" {
			data := map[string]interface{}{"sync_status": 2}
			if err := db.Table(table_name).Where("id = ?", r.Id).Updates(data).Error; err != nil {
				log("[ERROR]update record sync status failed, " + err.Error())
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
	Test     bool   `json:"test"`
	Force    bool   `json:"force"`
}

func (s *SyncService) LocalToRemote(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	if body.Force {
		for _, t := range tables {
			s.Biz.DB.Table(t.Name).Where("1 = 1").UpdateColumns(map[string]interface{}{
				"sync_status": 1,
			})
		}
	}
	results := make(map[string]*synchronizer.SynchronizeResult)
	remote_client := synchronizer.NewWebdavClient(client)
	for _, t := range tables {
		local_client := synchronizer.NewDatabaseLocalClient(s.Biz.DB, t.Name)
		if body.Test {
			r := synchronizer.BuildLocalSyncToRemoteTasks(t, body.RootDir, local_client, remote_client)
			results[t.Name] = r
		} else {
			r := local_to_remote(t, body.RootDir, s.Biz.DB, client)
			results[t.Name] = r
		}
	}
	return Ok(results)
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

func remote_to_local(t synchronizer.TableSynchronizeSetting, root_dir string, db *gorm.DB, client *gowebdav.Client) *synchronizer.SynchronizeResult {
	table_name := t.Name
	// id_field_name := t.IdFieldName
	local_client := synchronizer.NewDatabaseLocalClient(db, table_name)
	remote_client := synchronizer.NewWebdavClient(client)
	result := synchronizer.BuildRemoteSyncToLocalTasks(t, root_dir, local_client, remote_client)
	add_message := func(msg *synchronizer.SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	time_pattern := `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}:\d{2}))$`
	// var timestamp_regex = regexp.MustCompile(`^[0-9]{8}$`)
	for _, r := range result.RecordTasks {
		// var d map[string]interface{}
		// if err := json.Unmarshal([]byte(r.Content), &d); err != nil {
		// 	continue
		// }
		log("[LOG]apply record task, the type is " + r.Type)
		r.Data["sync_status"] = 2
		if r.Type == "create" {
			created_at_str, ok := r.Data["created_at"].(string)
			if !ok {
				continue
			}
			match, _ := regexp.MatchString(time_pattern, created_at_str)
			if match {
				t, err := time.Parse(time.RFC3339Nano, created_at_str)
				if err != nil {
					continue
				}
				r.Data["created_at"] = strconv.Itoa(int(t.UnixMilli()))
			}
			if err := db.Table(table_name).Create(r.Data).Error; err != nil {
				log("[LOG]create record task failed, because " + err.Error())
				continue
			}
		}
		if r.Type == "update" {
			result := db.Table(table_name).Where("id = ?", r.Id).Updates(r.Data)
			if result.Error != nil {
				log("[ERROR]update record failed, because " + result.Error.Error())
				add_message(&synchronizer.SynchronizeMessage{
					Type:  synchronizer.SynchronizeMessageError,
					Scope: "database",
					Text:  result.Error.Error(),
				})
				continue
			}
			if result.RowsAffected == 0 {
				log("[ERROR]update record failed, no matched record.")
				// errors = append(errors, fmt.Errorf("未找到要更新的记录ID: %s", r.Id))
				add_message(&synchronizer.SynchronizeMessage{
					Type:  synchronizer.SynchronizeMessageError,
					Scope: "database",
					Text:  "",
				})
				continue
			}
			log("[ERROR]update record success, affected rows " + strconv.Itoa(int(result.RowsAffected)))
		}
		if r.Type == "update_sync_status" {
			data := map[string]interface{}{"sync_status": 2}
			if err := db.Table(table_name).Where("id = ?", r.Id).Updates(data).Error; err != nil {
				log("[ERROR]update record sync status failed, " + err.Error())
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
	return result
}

func (s *SyncService) RemoteToLocal(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	remote_client := synchronizer.NewWebdavClient(client)
	results := make(map[string]*synchronizer.SynchronizeResult)
	for _, t := range tables {
		if body.Test {
			local_client := synchronizer.NewDatabaseLocalClient(s.Biz.DB, t.Name)
			r := synchronizer.BuildRemoteSyncToLocalTasks(t, body.RootDir, local_client, remote_client)
			results[t.Name] = r
		} else {
			r := remote_to_local(t, body.RootDir, s.Biz.DB, client)
			results[t.Name] = r
		}
	}
	return Ok(results)
}
