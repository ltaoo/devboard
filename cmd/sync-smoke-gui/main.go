package main

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ltaoo/velo"
	"github.com/ltaoo/velo/store"
	"github.com/studio-b12/gowebdav"

	"devboard/pkg/fsmock"
	"devboard/pkg/synchronizer"
)

//go:embed frontend
var frontendFS embed.FS

const tableName = "item"

var syncTables = []synchronizer.TableSynchronizeSetting{{
	Name:        tableName,
	IdFieldName: "id",
}}

type options struct {
	DeviceID string
	DataDir  string
}

type remoteConfig struct {
	Kind           string `json:"kind"`
	RootDir        string `json:"root_dir"`
	WebDAVURL      string `json:"webdav_url"`
	WebDAVUsername string `json:"webdav_username"`
	WebDAVPassword string `json:"webdav_password"`
	GitRepo        string `json:"git_repo"`
	GitPush        bool   `json:"git_push"`
}

type record struct {
	ID                string `json:"id"`
	Text              string `json:"text"`
	LastOperationTime string `json:"last_operation_time"`
	LastOperationType int    `json:"last_operation_type"`
	SyncStatus        int    `json:"sync_status"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at,omitempty"`
	DeletedAt         string `json:"deleted_at,omitempty"`
}

type deviceState struct {
	DeviceID   string       `json:"device_id"`
	Checkpoint int64        `json:"checkpoint"`
	NextID     int64        `json:"next_id"`
	Records    []record     `json:"records"`
	Remote     remoteConfig `json:"remote"`
	Logs       []string     `json:"logs"`
}

type appService struct {
	mu    sync.Mutex
	dir   string
	path  string
	state deviceState
}

type writableRemote interface {
	synchronizer.RemoteClient
	Prepare() error
	WriteFileOperations(ops []*synchronizer.FileOperation, rootDir string, manifestMustNotExist bool) error
	Finalize(message string) error
	Label() string
}

type syncOutput struct {
	Result     *synchronizer.SynchronizeResult `json:"result,omitempty"`
	Manifest   *synchronizer.Manifest          `json:"manifest,omitempty"`
	Checkpoint int64                           `json:"checkpoint"`
	Records    []record                        `json:"records"`
	Logs       []string                        `json:"logs"`
}

func main() {
	opts := parseFlags()
	if opts.DataDir == "" {
		fmt.Fprintln(os.Stderr, "--data-dir is required")
		os.Exit(1)
	}
	svc, err := openService(opts.DataDir, opts.DeviceID)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	app := velo.NewApp(&velo.VeloAppOpt{
		Mode:    velo.ModeBridge,
		AppName: "Devboard Sync Smoke",
		Title:   "Devboard Sync Smoke",
	})
	app.Store = store.NewWithDir(opts.DataDir)

	app.Get("/api/state", func(c *velo.BoxContext) interface{} {
		return c.Ok(svc.snapshot())
	})
	app.Post("/api/config", func(c *velo.BoxContext) interface{} {
		var req remoteConfig
		if err := c.BindJSON(&req); err != nil {
			return c.Error(err.Error())
		}
		if err := svc.saveRemoteConfig(req); err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(svc.snapshot())
	})
	app.Post("/api/record/create", func(c *velo.BoxContext) interface{} {
		var req struct {
			Text string `json:"text"`
		}
		if err := c.BindJSON(&req); err != nil {
			return c.Error(err.Error())
		}
		rec, err := svc.createRecord(req.Text)
		if err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(velo.H{"record": rec, "state": svc.snapshot()})
	})
	app.Post("/api/record/update", func(c *velo.BoxContext) interface{} {
		var req struct {
			ID   string `json:"id"`
			Text string `json:"text"`
		}
		if err := c.BindJSON(&req); err != nil {
			return c.Error(err.Error())
		}
		if err := svc.updateRecord(req.ID, req.Text); err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(svc.snapshot())
	})
	app.Post("/api/record/delete", func(c *velo.BoxContext) interface{} {
		var req struct {
			ID string `json:"id"`
		}
		if err := c.BindJSON(&req); err != nil {
			return c.Error(err.Error())
		}
		if err := svc.deleteRecord(req.ID); err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(svc.snapshot())
	})
	app.Post("/api/sync/pull", func(c *velo.BoxContext) interface{} {
		out, err := svc.pull()
		if err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(out)
	})
	app.Post("/api/sync/push", func(c *velo.BoxContext) interface{} {
		out, err := svc.push()
		if err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(out)
	})
	app.Post("/api/sync/full", func(c *velo.BoxContext) interface{} {
		if _, err := svc.pull(); err != nil {
			return c.Error(err.Error())
		}
		out, err := svc.push()
		if err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(out)
	})
	app.Get("/api/remote/manifest", func(c *velo.BoxContext) interface{} {
		manifest, exists, err := svc.remoteManifest()
		if err != nil {
			return c.Error(err.Error())
		}
		return c.Ok(velo.H{"exists": exists, "manifest": manifest})
	})

	app.NewWebview(&velo.VeloWebviewOpt{
		Name:       "sync-smoke-gui",
		Title:      "Devboard Sync Smoke",
		FrontendFS: frontendFS,
		Pathname:   "/",
		Width:      1180,
		Height:     760,
	})
	app.Run()
}

func parseFlags() options {
	var opts options
	flag.StringVar(&opts.DeviceID, "device", "", "device id")
	flag.StringVar(&opts.DataDir, "data-dir", "", "per-device local storage directory")
	flag.Parse()
	return opts
}

func openService(dir string, explicitDeviceID string) (*appService, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	svc := &appService{
		dir:  dir,
		path: filepath.Join(dir, "device-state.json"),
	}
	b, err := os.ReadFile(svc.path)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		deviceID := explicitDeviceID
		if deviceID == "" {
			deviceID = "device-" + shortHash(dir)
		}
		svc.state = deviceState{
			DeviceID: deviceID,
			NextID:   1,
			Records:  []record{},
			Remote: remoteConfig{
				Kind:    "webdav",
				RootDir: "/devboard-smoke-test",
				GitPush: true,
			},
			Logs: []string{},
		}
		return svc, svc.saveLocked()
	}
	if err := json.Unmarshal(b, &svc.state); err != nil {
		return nil, err
	}
	if explicitDeviceID != "" && explicitDeviceID != svc.state.DeviceID {
		svc.state.DeviceID = explicitDeviceID
	}
	if svc.state.DeviceID == "" {
		svc.state.DeviceID = "device-" + shortHash(dir)
	}
	if svc.state.NextID == 0 {
		svc.state.NextID = int64(len(svc.state.Records) + 1)
	}
	if svc.state.Remote.Kind == "" {
		svc.state.Remote.Kind = "webdav"
	}
	if svc.state.Remote.RootDir == "" {
		svc.state.Remote.RootDir = "/devboard-smoke-test"
	}
	return svc, svc.saveLocked()
}

func (s *appService) saveLocked() error {
	if err := os.MkdirAll(s.dir, 0755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, b, 0644)
}

func (s *appService) snapshot() deviceState {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := s.state
	cp.Records = append([]record(nil), s.state.Records...)
	cp.Logs = append([]string(nil), s.state.Logs...)
	return cp
}

func (s *appService) addLogLocked(format string, args ...interface{}) {
	line := time.Now().Format("15:04:05") + " " + fmt.Sprintf(format, args...)
	s.state.Logs = append(s.state.Logs, line)
	if len(s.state.Logs) > 200 {
		s.state.Logs = s.state.Logs[len(s.state.Logs)-200:]
	}
}

func (s *appService) saveRemoteConfig(cfg remoteConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg.Kind = strings.TrimSpace(cfg.Kind)
	if cfg.Kind == "" {
		cfg.Kind = "webdav"
	}
	if cfg.RootDir == "" {
		cfg.RootDir = "/devboard-smoke-test"
	}
	if cfg.Kind != "webdav" && cfg.Kind != "git" {
		return fmt.Errorf("unsupported remote kind %q", cfg.Kind)
	}
	s.state.Remote = cfg
	s.addLogLocked("saved remote config: %s %s", cfg.Kind, cfg.RootDir)
	return s.saveLocked()
}

func (s *appService) createRecord(text string) (record, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	text = strings.TrimSpace(text)
	if text == "" {
		return record{}, errors.New("text is required")
	}
	now := nowMillis()
	rec := record{
		ID:                fmt.Sprintf("%s-%06d", s.state.DeviceID, s.state.NextID),
		Text:              text,
		LastOperationTime: now,
		LastOperationType: 1,
		SyncStatus:        1,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	s.state.NextID++
	s.state.Records = append(s.state.Records, rec)
	s.addLogLocked("created %s", rec.ID)
	return rec, s.saveLocked()
}

func (s *appService) updateRecord(id string, text string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.findIndexLocked(id)
	if idx < 0 {
		return fmt.Errorf("record %s not found", id)
	}
	if s.state.Records[idx].DeletedAt != "" {
		return fmt.Errorf("record %s is deleted", id)
	}
	now := nowMillis()
	s.state.Records[idx].Text = strings.TrimSpace(text)
	s.state.Records[idx].UpdatedAt = now
	s.state.Records[idx].LastOperationTime = now
	s.state.Records[idx].LastOperationType = 2
	s.state.Records[idx].SyncStatus = 1
	s.addLogLocked("updated %s", id)
	return s.saveLocked()
}

func (s *appService) deleteRecord(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.findIndexLocked(id)
	if idx < 0 {
		return fmt.Errorf("record %s not found", id)
	}
	now := nowMillis()
	s.state.Records[idx].UpdatedAt = now
	s.state.Records[idx].DeletedAt = now
	s.state.Records[idx].LastOperationTime = now
	s.state.Records[idx].LastOperationType = 3
	s.state.Records[idx].SyncStatus = 1
	s.addLogLocked("deleted %s", id)
	return s.saveLocked()
}

func (s *appService) pull() (*syncOutput, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	remote, rootDir, err := s.openRemoteLocked()
	if err != nil {
		return nil, err
	}
	if err := remote.Prepare(); err != nil {
		return nil, err
	}
	_, existed, err := synchronizer.ReadManifest(remote, rootDir)
	if err != nil {
		return nil, err
	}
	if !existed {
		s.addLogLocked("pull skipped: remote manifest not found")
		_ = s.saveLocked()
		return s.outputLocked(nil, nil), nil
	}
	result, manifest, nextCheckpoint := synchronizer.BuildRemoteOpTasks(syncTables, rootDir, s.localFactoryLocked, remote, s.state.Checkpoint)
	if len(result.Messages) != 0 {
		s.addLogLocked("pull stopped with %d message(s)", len(result.Messages))
		_ = s.saveLocked()
		return s.outputLocked(result, &manifest), nil
	}
	if err := s.applyRecordTasksLocked(result); err != nil {
		s.addLogLocked("pull conflict: %v", err)
		_ = s.saveLocked()
		return nil, err
	}
	if nextCheckpoint != s.state.Checkpoint {
		s.state.Checkpoint = nextCheckpoint
	}
	s.addLogLocked("pull complete: checkpoint=%d tasks=%d", s.state.Checkpoint, len(result.RecordTasks))
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return s.outputLocked(result, &manifest), nil
}

func (s *appService) push() (*syncOutput, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	remote, rootDir, err := s.openRemoteLocked()
	if err != nil {
		return nil, err
	}
	if err := remote.Prepare(); err != nil {
		return nil, err
	}
	_, existed, err := synchronizer.ReadManifest(remote, rootDir)
	if err != nil {
		return nil, err
	}
	result, manifest := synchronizer.BuildLocalOpSegment(syncTables, rootDir, s.localFactoryLocked, remote, s.state.DeviceID, synchronizer.DefaultSegmentSize)
	if len(result.Messages) != 0 {
		s.addLogLocked("push stopped with %d message(s)", len(result.Messages))
		_ = s.saveLocked()
		return s.outputLocked(result, &manifest), nil
	}
	if len(result.FileOperations) == 0 {
		s.state.Checkpoint = manifest.Checkpoint
		s.addLogLocked("push skipped: no draft records")
		if err := s.saveLocked(); err != nil {
			return nil, err
		}
		return s.outputLocked(result, &manifest), nil
	}
	currentManifest, currentExists, err := synchronizer.ReadManifest(remote, rootDir)
	if err != nil {
		return nil, err
	}
	if currentManifest.Checkpoint != result.BaseCheckpoint || currentExists != existed {
		return nil, errors.New("remote manifest changed; pull again before pushing")
	}
	if err := remote.WriteFileOperations(result.FileOperations, rootDir, !currentExists); err != nil {
		return nil, err
	}
	if err := remote.Finalize(fmt.Sprintf("sync smoke gui %s checkpoint %d", s.state.DeviceID, manifest.Checkpoint)); err != nil {
		return nil, err
	}
	if err := s.applyRecordTasksLocked(result); err != nil {
		return nil, err
	}
	s.state.Checkpoint = manifest.Checkpoint
	s.addLogLocked("push complete: checkpoint=%d file_ops=%d", s.state.Checkpoint, len(result.FileOperations))
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return s.outputLocked(result, &manifest), nil
}

func (s *appService) remoteManifest() (*synchronizer.Manifest, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	remote, rootDir, err := s.openRemoteLocked()
	if err != nil {
		return nil, false, err
	}
	if err := remote.Prepare(); err != nil {
		return nil, false, err
	}
	manifest, existed, err := synchronizer.ReadManifest(remote, rootDir)
	if err != nil {
		return nil, false, err
	}
	return &manifest, existed, nil
}

func (s *appService) outputLocked(result *synchronizer.SynchronizeResult, manifest *synchronizer.Manifest) *syncOutput {
	return &syncOutput{
		Result:     result,
		Manifest:   manifest,
		Checkpoint: s.state.Checkpoint,
		Records:    append([]record(nil), s.state.Records...),
		Logs:       append([]string(nil), s.state.Logs...),
	}
}

func (s *appService) localFactoryLocked(synchronizer.TableSynchronizeSetting) synchronizer.LocalClient {
	return s
}

func (s *appService) applyRecordTasksLocked(result *synchronizer.SynchronizeResult) error {
	if result == nil {
		return nil
	}
	for _, task := range result.RecordTasks {
		switch task.Type {
		case "create", "update":
			rec, err := mapToRecord(task.Data)
			if err != nil {
				return err
			}
			rec.SyncStatus = 2
			s.upsertRecordLocked(rec)
		case "delete":
			s.applyDeleteLocked(task.Id)
		case "to_published":
			s.setSyncStatusLocked(task.Id, 2)
		case "to_draft":
			s.setSyncStatusLocked(task.Id, 1)
		case "conflict":
			return fmt.Errorf("conflict on %s: local=%v remote=%v", task.Id, task.Data["local_last_operation"], task.Data["remote_last_operation"])
		}
	}
	return nil
}

func (s *appService) openRemoteLocked() (writableRemote, string, error) {
	cfg := s.state.Remote
	if cfg.RootDir == "" {
		cfg.RootDir = "/devboard-smoke-test"
	}
	switch cfg.Kind {
	case "webdav", "":
		if cfg.WebDAVURL == "" {
			return nil, "", errors.New("WebDAV URL is required")
		}
		client := gowebdav.NewClient(cfg.WebDAVURL, cfg.WebDAVUsername, cfg.WebDAVPassword)
		if err := client.Connect(); err != nil {
			return nil, "", err
		}
		return &webDAVRemote{client: client}, cfg.RootDir, nil
	case "git":
		if cfg.GitRepo == "" {
			return nil, "", errors.New("Git repo path is required")
		}
		remote, err := newGitRemote(cfg.GitRepo, cfg.GitPush)
		return remote, cfg.RootDir, err
	default:
		return nil, "", fmt.Errorf("unsupported remote kind %q", cfg.Kind)
	}
}

func (s *appService) findIndexLocked(id string) int {
	for i, rec := range s.state.Records {
		if rec.ID == id {
			return i
		}
	}
	return -1
}

func (s *appService) upsertRecordLocked(rec record) {
	idx := s.findIndexLocked(rec.ID)
	if idx < 0 {
		s.state.Records = append(s.state.Records, rec)
		return
	}
	s.state.Records[idx] = rec
}

func (s *appService) setSyncStatusLocked(id string, status int) {
	idx := s.findIndexLocked(id)
	if idx >= 0 {
		s.state.Records[idx].SyncStatus = status
	}
}

func (s *appService) applyDeleteLocked(id string) {
	idx := s.findIndexLocked(id)
	now := nowMillis()
	if idx < 0 {
		s.state.Records = append(s.state.Records, record{
			ID:                id,
			LastOperationTime: now,
			LastOperationType: 3,
			SyncStatus:        2,
			CreatedAt:         now,
			UpdatedAt:         now,
			DeletedAt:         now,
		})
		return
	}
	s.state.Records[idx].DeletedAt = now
	s.state.Records[idx].UpdatedAt = now
	s.state.Records[idx].LastOperationType = 3
	s.state.Records[idx].SyncStatus = 2
}

func (s *appService) FetchTableLastDraftRecord() (map[string]interface{}, error) {
	var latest *record
	for i := range s.state.Records {
		rec := &s.state.Records[i]
		if rec.SyncStatus != 1 {
			continue
		}
		if latest == nil || rec.LastOperationTime > latest.LastOperationTime {
			latest = rec
		}
	}
	if latest == nil {
		return nil, nil
	}
	return latest.toMap(), nil
}

func (s *appService) FetchUniqueDaysOfTable() []string {
	seen := map[string]struct{}{}
	for _, rec := range s.state.Records {
		if rec.SyncStatus != 1 {
			continue
		}
		seen[dayOfMillis(rec.CreatedAt)] = struct{}{}
	}
	days := make([]string, 0, len(seen))
	for day := range seen {
		days = append(days, day)
	}
	sort.Strings(days)
	return days
}

func (s *appService) FetchRecordsBetweenSpecialDayOfTable(day string) ([]map[string]interface{}, error) {
	var records []map[string]interface{}
	for _, rec := range s.state.Records {
		if dayOfMillis(rec.CreatedAt) == day {
			records = append(records, rec.toMap())
		}
	}
	sort.Slice(records, func(i, j int) bool {
		a, _ := records[i]["last_operation_time"].(string)
		b, _ := records[j]["last_operation_time"].(string)
		return a > b
	})
	return records, nil
}

func (s *appService) FetchRecordCountBetweenSpecialDayOfTable(day string) (int64, error) {
	records, err := s.FetchRecordsBetweenSpecialDayOfTable(day)
	return int64(len(records)), err
}

func (s *appService) FetchRecordOrderByTimeAndBetweenStartAndEndOfTable(day string) ([]map[string]interface{}, error) {
	return s.FetchRecordsBetweenSpecialDayOfTable(day)
}

func (s *appService) FetchRecordById(id string) ([]map[string]interface{}, error) {
	idx := s.findIndexLocked(id)
	if idx < 0 {
		return []map[string]interface{}{}, nil
	}
	return []map[string]interface{}{s.state.Records[idx].toMap()}, nil
}

func (s *appService) FetchAllRecords() ([]map[string]interface{}, error) {
	records := make([]map[string]interface{}, 0, len(s.state.Records))
	for _, rec := range s.state.Records {
		records = append(records, rec.toMap())
	}
	return records, nil
}

func (s *appService) SetRecords(v []map[string]interface{}) {
	s.state.Records = make([]record, 0, len(v))
	for _, item := range v {
		rec, err := mapToRecord(item)
		if err == nil {
			s.state.Records = append(s.state.Records, rec)
		}
	}
}

func (r record) toMap() map[string]interface{} {
	return map[string]interface{}{
		"id":                  r.ID,
		"text":                r.Text,
		"last_operation_time": r.LastOperationTime,
		"last_operation_type": r.LastOperationType,
		"sync_status":         r.SyncStatus,
		"created_at":          r.CreatedAt,
		"updated_at":          r.UpdatedAt,
		"deleted_at":          r.DeletedAt,
	}
}

func mapToRecord(data map[string]interface{}) (record, error) {
	id := stringFromAny(data["id"])
	if id == "" {
		return record{}, errors.New("record missing id")
	}
	return record{
		ID:                id,
		Text:              stringFromAny(data["text"]),
		LastOperationTime: stringFromAny(data["last_operation_time"]),
		LastOperationType: intFromAny(data["last_operation_type"]),
		SyncStatus:        intFromAny(data["sync_status"]),
		CreatedAt:         stringFromAny(data["created_at"]),
		UpdatedAt:         stringFromAny(data["updated_at"]),
		DeletedAt:         stringFromAny(data["deleted_at"]),
	}, nil
}

type webDAVRemote struct {
	client *gowebdav.Client
}

func (r *webDAVRemote) Label() string  { return "webdav" }
func (r *webDAVRemote) Prepare() error { return nil }
func (r *webDAVRemote) Stat(p string) (os.FileInfo, error) {
	return r.client.Stat(p)
}
func (r *webDAVRemote) Read(p string) ([]byte, error) {
	return r.client.Read(p)
}
func (r *webDAVRemote) ReadDir(p string) ([]os.FileInfo, error) {
	return r.client.ReadDir(p)
}
func (r *webDAVRemote) IsErrNotFound(err error) bool {
	return gowebdav.IsErrNotFound(err)
}
func (r *webDAVRemote) WithDirectoryStructure(map[string]interface{}) {}
func (r *webDAVRemote) BuildStructure(string, map[string]interface{}) {}
func (r *webDAVRemote) SetFS(*fsmock.FS)                              {}
func (r *webDAVRemote) Finalize(string) error                         { return nil }

func (r *webDAVRemote) WriteFileOperations(ops []*synchronizer.FileOperation, rootDir string, manifestMustNotExist bool) error {
	manifestPath := path.Join(rootDir, synchronizer.ManifestFilename)
	manifestETag := ""
	if !manifestMustNotExist {
		info, err := r.client.Stat(manifestPath)
		if err != nil {
			return err
		}
		if etagInfo, ok := info.(interface{ ETag() string }); ok {
			manifestETag = etagInfo.ETag()
		}
	}
	if err := r.client.MkdirAll(rootDir, 0755); err != nil {
		return err
	}
	if err := r.client.MkdirAll(path.Join(rootDir, synchronizer.OpsDirname), 0755); err != nil {
		return err
	}
	if err := r.client.MkdirAll(path.Join(rootDir, synchronizer.SnapshotDirname), 0755); err != nil {
		return err
	}
	for _, op := range ops {
		if op.Filepath == manifestPath {
			continue
		}
		if err := r.client.MkdirAll(path.Dir(op.Filepath), 0755); err != nil {
			return err
		}
		if err := r.client.Write(op.Filepath, []byte(op.Content), 0644); err != nil {
			return err
		}
	}
	for _, op := range ops {
		if op.Filepath != manifestPath {
			continue
		}
		r.client.SetInterceptor(func(method string, req *http.Request) {
			if method != "PUT" {
				return
			}
			if manifestMustNotExist {
				req.Header.Set("If-None-Match", "*")
				return
			}
			if manifestETag != "" {
				req.Header.Set("If-Match", manifestETag)
			}
		})
		err := r.client.Write(op.Filepath, []byte(op.Content), 0644)
		r.client.SetInterceptor(nil)
		if err != nil {
			return err
		}
	}
	return nil
}

type gitRemote struct {
	repo string
	push bool
}

func newGitRemote(repo string, push bool) (*gitRemote, error) {
	r := &gitRemote{repo: repo, push: push}
	if err := os.MkdirAll(repo, 0755); err != nil {
		return nil, err
	}
	if _, err := os.Stat(filepath.Join(repo, ".git")); os.IsNotExist(err) {
		if err := r.git("init"); err != nil {
			return nil, err
		}
	}
	_ = r.git("config", "user.email", "sync-smoke@example.local")
	_ = r.git("config", "user.name", "Sync Smoke GUI")
	return r, nil
}

func (r *gitRemote) Label() string { return "git:" + r.repo }
func (r *gitRemote) Prepare() error {
	if r.hasRemote() {
		return r.git("pull", "--rebase", "--autostash")
	}
	return nil
}
func (r *gitRemote) Stat(p string) (os.FileInfo, error) {
	return os.Stat(r.fullPath(p))
}
func (r *gitRemote) Read(p string) ([]byte, error) {
	return os.ReadFile(r.fullPath(p))
}
func (r *gitRemote) ReadDir(p string) ([]os.FileInfo, error) {
	entries, err := os.ReadDir(r.fullPath(p))
	if err != nil {
		return nil, err
	}
	files := make([]os.FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		files = append(files, info)
	}
	return files, nil
}
func (r *gitRemote) IsErrNotFound(err error) bool {
	return os.IsNotExist(err)
}
func (r *gitRemote) WithDirectoryStructure(map[string]interface{}) {}
func (r *gitRemote) BuildStructure(string, map[string]interface{}) {}
func (r *gitRemote) SetFS(*fsmock.FS)                              {}

func (r *gitRemote) WriteFileOperations(ops []*synchronizer.FileOperation, rootDir string, manifestMustNotExist bool) error {
	manifestPath := path.Join(rootDir, synchronizer.ManifestFilename)
	if manifestMustNotExist {
		if _, err := os.Stat(r.fullPath(manifestPath)); err == nil {
			return errors.New("manifest already exists")
		}
	}
	for _, op := range ops {
		if op.Filepath == manifestPath {
			continue
		}
		if err := r.writeFile(op.Filepath, op.Content); err != nil {
			return err
		}
	}
	for _, op := range ops {
		if op.Filepath == manifestPath {
			if err := r.writeFile(op.Filepath, op.Content); err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *gitRemote) Finalize(message string) error {
	status, err := r.gitOutput("status", "--porcelain")
	if err != nil {
		return err
	}
	if strings.TrimSpace(status) == "" {
		return nil
	}
	if err := r.git("add", "."); err != nil {
		return err
	}
	if err := r.git("commit", "-m", message); err != nil {
		return err
	}
	if r.push && r.hasRemote() {
		return r.git("push")
	}
	return nil
}

func (r *gitRemote) writeFile(remotePath string, content string) error {
	full := r.fullPath(remotePath)
	if err := os.MkdirAll(filepath.Dir(full), 0755); err != nil {
		return err
	}
	return os.WriteFile(full, []byte(content), 0644)
}

func (r *gitRemote) fullPath(remotePath string) string {
	clean := strings.TrimLeft(path.Clean(remotePath), "/")
	if clean == "." {
		clean = ""
	}
	return filepath.Join(r.repo, filepath.FromSlash(clean))
}

func (r *gitRemote) hasRemote() bool {
	out, err := r.gitOutput("remote")
	return err == nil && strings.TrimSpace(out) != ""
}

func (r *gitRemote) git(args ...string) error {
	_, err := r.gitOutput(args...)
	return err
}

func (r *gitRemote) gitOutput(args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", r.repo}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("git %s failed: %w\n%s", strings.Join(args, " "), err, string(out))
	}
	return string(out), nil
}

func nowMillis() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

func dayOfMillis(value string) string {
	ms, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return "1970-01-01"
	}
	return time.UnixMilli(ms).Format("2006-01-02")
}

func shortHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])[:8]
}

func stringFromAny(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case []byte:
		return string(t)
	case int:
		return strconv.FormatInt(int64(t), 10)
	case int64:
		return strconv.FormatInt(t, 10)
	case float64:
		if t == 0 {
			return ""
		}
		return strconv.FormatInt(int64(t), 10)
	case nil:
		return ""
	default:
		return fmt.Sprint(t)
	}
}

func intFromAny(v interface{}) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case string:
		i, _ := strconv.Atoi(t)
		return i
	default:
		return 0
	}
}
