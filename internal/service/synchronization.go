package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"time"

	"github.com/studio-b12/gowebdav"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/pkg/synchronizer"
)

type SynchronizeService struct {
	Biz *biz.BizApp
}

func NewSynchronizeService(biz *biz.BizApp) *SynchronizeService {
	return &SynchronizeService{
		Biz: biz,
	}
}

type DatabaseField struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Text  string `json:"text"`
}

func (s *SynchronizeService) FetchDatabaseDirs() *Result {
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

func (s *SynchronizeService) PingWebDav(body WebDavSyncConfigBody) *Result {
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
	result := synchronizer.BuildLocalToRemoteTasks(t, root_dir, local_client, remote_client)
	// add_message := func(msg *synchronizer.SynchronizeMessage) {
	// 	result.Messages = append(result.Messages, msg)
	// }
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	for _, file := range result.FileOperations {
		if file.Type == "new_file" {
			log("[LOG]create file " + file.Filepath + " in remote")
			data := []byte(file.Content)
			if err := client.Write(file.Filepath, data, 0644); err != nil {
				log("[ERROR]write file failed, because " + err.Error())
				continue
			}
		}
		if file.Type == "update_file" {
			log("[LOG]update file " + file.Filepath + " in remote")
			data := []byte(file.Content)
			if err := client.Write(file.Filepath, data, 0644); err != nil {
				log("[ERROR]update file failed, because " + err.Error())
				continue
			}
		}
	}
	for _, r := range result.RecordTasks {
		if r.Type == "to_published" {
			log("[LOG]update record sync_status")
			data := map[string]interface{}{"sync_status": 2}
			if err := db.Table(table_name).Where("id = ?", r.Id).Updates(data).Error; err != nil {
				log("[ERROR]update record sync status failed, " + err.Error())
			}
		}
	}

	return result
}

type localSyncState struct {
	WebDAVCheckpoints map[string]int64 `json:"webdav_checkpoints"`
}

type WebDavSyncConfigBody struct {
	URL      string `json:"url"`
	RootDir  string `json:"root_dir"`
	Username string `json:"username"`
	Password string `json:"password"`
	Test     bool   `json:"test"`
	Force    bool   `json:"force"`
}

func (s *SynchronizeService) LocalToRemote(body WebDavSyncConfigBody) *Result {
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
	remote_client := synchronizer.NewWebdavClient(client)
	local_factory := func(t synchronizer.TableSynchronizeSetting) synchronizer.LocalClient {
		return synchronizer.NewDatabaseLocalClient(s.Biz.DB, t.Name)
	}
	results := make(map[string]*synchronizer.SynchronizeResult)

	if !body.Test {
		_, manifest_exists, err := synchronizer.ReadManifest(remote_client, body.RootDir)
		if err != nil {
			return Error(err)
		}
		if manifest_exists {
			checkpoint, err := s.readWebDAVCheckpoint(body)
			if err != nil {
				return Error(err)
			}
			pull_result, _, next_checkpoint := synchronizer.BuildRemoteOpTasks(tables, body.RootDir, local_factory, remote_client, checkpoint)
			s.applyRecordTasks(pull_result)
			if len(pull_result.Messages) == 0 && next_checkpoint != checkpoint {
				if err := s.writeWebDAVCheckpoint(body, next_checkpoint); err != nil {
					return Error(err)
				}
			}
			results["pull"] = pull_result
		}
	}

	push_result, manifest := synchronizer.BuildLocalOpSegment(tables, body.RootDir, local_factory, remote_client, s.Biz.MachineId, synchronizer.DefaultSegmentSize)
	results["push"] = push_result
	if body.Test {
		return Ok(results)
	}
	if len(push_result.Messages) != 0 {
		return Ok(results)
	}
	if len(push_result.FileOperations) == 0 {
		if err := s.writeWebDAVCheckpoint(body, manifest.Checkpoint); err != nil {
			return Error(err)
		}
		return Ok(results)
	}
	current_manifest, manifest_exists, err := synchronizer.ReadManifest(remote_client, body.RootDir)
	if err != nil {
		return Error(err)
	}
	if current_manifest.Checkpoint != push_result.BaseCheckpoint {
		push_result.Messages = append(push_result.Messages, &synchronizer.SynchronizeMessage{
			Type:  synchronizer.SynchronizeMessageError,
			Scope: "webdav",
			Text:  "远端 manifest 已变化，请重新同步",
		})
		return Ok(results)
	}
	if err := ensureWebDAVLayout(client, body.RootDir); err != nil {
		return Error(err)
	}
	manifest_etag, err := fetchWebDAVManifestETag(client, body.RootDir, manifest_exists)
	if err != nil {
		return Error(err)
	}
	if err := writeFileOperations(client, push_result.FileOperations, body.RootDir, manifest_etag, !manifest_exists); err != nil {
		return Error(err)
	}
	s.applyRecordTasks(push_result)
	if err := s.writeWebDAVCheckpoint(body, manifest.Checkpoint); err != nil {
		return Error(err)
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
	result := synchronizer.BuildRemoteToLocalTasks(t, root_dir, local_client, remote_client)
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
		if r.Type == "create" {
			r.Data["sync_status"] = 2
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
			r.Data["sync_status"] = 2
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
		if r.Type == "to_draft" {
			data := map[string]interface{}{"sync_status": 1}
			if err := db.Table(table_name).Where("id = ?", r.Id).Updates(data).Error; err != nil {
				log("[ERROR]update record sync status failed, " + err.Error())
			}
		}
		if r.Type == "to_published" {
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

func (s *SynchronizeService) RemoteToLocal(body WebDavSyncConfigBody) *Result {
	client := gowebdav.NewClient(body.URL, body.Username, body.Password)
	err := client.Connect()
	if err != nil {
		return Error(err)
	}
	remote_client := synchronizer.NewWebdavClient(client)
	results := make(map[string]*synchronizer.SynchronizeResult)
	local_factory := func(t synchronizer.TableSynchronizeSetting) synchronizer.LocalClient {
		return synchronizer.NewDatabaseLocalClient(s.Biz.DB, t.Name)
	}
	checkpoint, err := s.readWebDAVCheckpoint(body)
	if err != nil {
		return Error(err)
	}
	result, _, next_checkpoint := synchronizer.BuildRemoteOpTasks(tables, body.RootDir, local_factory, remote_client, checkpoint)
	results["pull"] = result
	if body.Test {
		return Ok(results)
	}
	s.applyRecordTasks(result)
	if len(result.Messages) == 0 && next_checkpoint != checkpoint {
		if err := s.writeWebDAVCheckpoint(body, next_checkpoint); err != nil {
			return Error(err)
		}
	}
	return Ok(results)
}

func (s *SynchronizeService) applyRecordTasks(result *synchronizer.SynchronizeResult) {
	add_message := func(msg *synchronizer.SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	for _, r := range result.RecordTasks {
		table_name, ok := r.Data["table"].(string)
		if !ok || table_name == "" {
			log("[ERROR]record task missing table name")
			continue
		}
		log("[LOG]apply file-log record task " + r.Type + " on " + table_name + "/" + r.Id)
		switch r.Type {
		case "create":
			r.Data["sync_status"] = 2
			delete(r.Data, "table")
			if err := s.Biz.DB.Table(table_name).Create(r.Data).Error; err != nil {
				log("[ERROR]create record task failed, because " + err.Error())
				add_message(&synchronizer.SynchronizeMessage{
					Type:  synchronizer.SynchronizeMessageError,
					Scope: "database",
					Text:  err.Error(),
				})
			}
		case "update":
			r.Data["sync_status"] = 2
			delete(r.Data, "table")
			db_result := s.Biz.DB.Table(table_name).Where("id = ?", r.Id).Updates(r.Data)
			if db_result.Error != nil {
				log("[ERROR]update record failed, because " + db_result.Error.Error())
				add_message(&synchronizer.SynchronizeMessage{
					Type:  synchronizer.SynchronizeMessageError,
					Scope: "database",
					Text:  db_result.Error.Error(),
				})
			}
		case "delete":
			data := map[string]interface{}{
				"sync_status":         2,
				"last_operation_type": 3,
				"deleted_at":          time.Now(),
			}
			if err := s.Biz.DB.Table(table_name).Where("id = ?", r.Id).Updates(data).Error; err != nil {
				log("[ERROR]delete tombstone update failed, " + err.Error())
				add_message(&synchronizer.SynchronizeMessage{
					Type:  synchronizer.SynchronizeMessageError,
					Scope: "database",
					Text:  err.Error(),
				})
			}
		case "to_draft":
			if err := s.Biz.DB.Table(table_name).Where("id = ?", r.Id).Updates(map[string]interface{}{"sync_status": 1}).Error; err != nil {
				log("[ERROR]update record sync status failed, " + err.Error())
			}
		case "to_published":
			if err := s.Biz.DB.Table(table_name).Where("id = ?", r.Id).Updates(map[string]interface{}{"sync_status": 2}).Error; err != nil {
				log("[ERROR]update record sync status failed, " + err.Error())
			}
		case "conflict":
			log("[ERROR]conflict detected for " + table_name + "/" + r.Id)
			add_message(&synchronizer.SynchronizeMessage{
				Type:  synchronizer.SynchronizeMessageError,
				Scope: "conflict",
				Text:  "检测到同步冲突：" + table_name + "/" + r.Id,
			})
		}
	}
}

func ensureWebDAVLayout(client *gowebdav.Client, rootDir string) error {
	if err := client.MkdirAll(rootDir, 0755); err != nil {
		return err
	}
	for _, dir := range []string{synchronizer.OpsDirname, synchronizer.SnapshotDirname} {
		if err := client.MkdirAll(path.Join(rootDir, dir), 0755); err != nil {
			return err
		}
	}
	return nil
}

func writeFileOperations(client *gowebdav.Client, ops []*synchronizer.FileOperation, rootDir string, manifestETag string, manifestMustNotExist bool) error {
	manifest_path := path.Join(rootDir, synchronizer.ManifestFilename)
	for _, file := range ops {
		if file.Filepath == manifest_path {
			continue
		}
		if err := client.MkdirAll(path.Dir(file.Filepath), 0755); err != nil {
			return err
		}
		if err := client.Write(file.Filepath, []byte(file.Content), 0644); err != nil {
			return err
		}
	}
	for _, file := range ops {
		if file.Filepath != manifest_path {
			continue
		}
		if err := client.MkdirAll(path.Dir(file.Filepath), 0755); err != nil {
			return err
		}
		client.SetInterceptor(func(method string, rq *http.Request) {
			if method != "PUT" {
				return
			}
			if manifestMustNotExist {
				rq.Header.Set("If-None-Match", "*")
				return
			}
			if manifestETag != "" {
				rq.Header.Set("If-Match", manifestETag)
			}
		})
		err := client.Write(file.Filepath, []byte(file.Content), 0644)
		client.SetInterceptor(nil)
		if err != nil {
			return err
		}
	}
	return nil
}

func fetchWebDAVManifestETag(client *gowebdav.Client, rootDir string, manifestExists bool) (string, error) {
	if !manifestExists {
		return "", nil
	}
	info, err := client.Stat(path.Join(rootDir, synchronizer.ManifestFilename))
	if err != nil {
		return "", err
	}
	if etagInfo, ok := info.(interface{ ETag() string }); ok {
		return etagInfo.ETag(), nil
	}
	return "", nil
}

func (s *SynchronizeService) readWebDAVCheckpoint(body WebDavSyncConfigBody) (int64, error) {
	state, err := s.readLocalSyncState()
	if err != nil {
		return 0, err
	}
	return state.WebDAVCheckpoints[webDAVStateKey(body)], nil
}

func (s *SynchronizeService) writeWebDAVCheckpoint(body WebDavSyncConfigBody, checkpoint int64) error {
	state, err := s.readLocalSyncState()
	if err != nil {
		return err
	}
	state.WebDAVCheckpoints[webDAVStateKey(body)] = checkpoint
	return s.writeLocalSyncState(state)
}

func (s *SynchronizeService) readLocalSyncState() (*localSyncState, error) {
	file_path := s.localSyncStatePath()
	b, err := os.ReadFile(file_path)
	if err != nil {
		if os.IsNotExist(err) {
			return &localSyncState{WebDAVCheckpoints: map[string]int64{}}, nil
		}
		return nil, err
	}
	var state localSyncState
	if err := json.Unmarshal(b, &state); err != nil {
		return nil, err
	}
	if state.WebDAVCheckpoints == nil {
		state.WebDAVCheckpoints = map[string]int64{}
	}
	return &state, nil
}

func (s *SynchronizeService) writeLocalSyncState(state *localSyncState) error {
	if err := os.MkdirAll(filepath.Dir(s.localSyncStatePath()), 0755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.localSyncStatePath(), b, 0644)
}

func (s *SynchronizeService) localSyncStatePath() string {
	return filepath.Join(s.Biz.Config.UserConfigDir, "sync-state.json")
}

func webDAVStateKey(body WebDavSyncConfigBody) string {
	sum := sha256.Sum256([]byte(body.URL + "|" + body.RootDir))
	return hex.EncodeToString(sum[:])
}
