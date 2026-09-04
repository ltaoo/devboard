package main

import (
	"bufio"
	"crypto/sha256"
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
	"time"

	"github.com/studio-b12/gowebdav"

	"devboard/pkg/fsmock"
	"devboard/pkg/synchronizer"
)

const tableName = "item"

var syncTables = []synchronizer.TableSynchronizeSetting{{
	Name:        tableName,
	IdFieldName: "id",
}}

type options struct {
	DeviceID   string
	DataDir    string
	RemoteKind string
	RootDir    string

	WebDAVURL      string
	WebDAVUsername string
	WebDAVPassword string

	GitRepo string
	GitPush bool

	Command string
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

type localState struct {
	DeviceID   string   `json:"device_id"`
	Checkpoint int64    `json:"checkpoint"`
	NextID     int64    `json:"next_id"`
	Records    []record `json:"records"`
}

type localStore struct {
	dir   string
	path  string
	state localState
}

type writableRemote interface {
	synchronizer.RemoteClient
	Prepare() error
	WriteFileOperations(ops []*synchronizer.FileOperation, rootDir string, manifestMustNotExist bool) error
	Finalize(message string) error
	Label() string
}

func main() {
	opts := parseFlags()
	if err := run(opts); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func parseFlags() options {
	var opts options
	flag.StringVar(&opts.DeviceID, "device", "", "device id; defaults to a stable id in --data-dir")
	flag.StringVar(&opts.DataDir, "data-dir", "", "per-device local storage directory")
	flag.StringVar(&opts.RemoteKind, "remote", "webdav", "remote backend: webdav or git")
	flag.StringVar(&opts.RootDir, "root-dir", "/devboard-smoke-test", "remote sync root directory")
	flag.StringVar(&opts.WebDAVURL, "webdav-url", "", "WebDAV endpoint URL")
	flag.StringVar(&opts.WebDAVUsername, "webdav-user", "", "WebDAV username")
	flag.StringVar(&opts.WebDAVPassword, "webdav-pass", "", "WebDAV password")
	flag.StringVar(&opts.GitRepo, "git-repo", "", "git working copy directory")
	flag.BoolVar(&opts.GitPush, "git-push", true, "push git commits when a remote exists")
	flag.StringVar(&opts.Command, "cmd", "", "run semicolon-separated commands and exit")
	flag.Parse()
	return opts
}

func run(opts options) error {
	if opts.DataDir == "" {
		return errors.New("--data-dir is required")
	}
	store, err := openLocalStore(opts.DataDir, opts.DeviceID)
	if err != nil {
		return err
	}
	remote, err := openRemote(opts)
	if err != nil {
		return err
	}
	fmt.Printf("device=%s data_dir=%s remote=%s root=%s\n", store.state.DeviceID, opts.DataDir, remote.Label(), opts.RootDir)
	app := &shellApp{
		opts:   opts,
		store:  store,
		remote: remote,
	}
	if opts.Command != "" {
		for _, cmd := range strings.Split(opts.Command, ";") {
			if err := app.runLine(strings.TrimSpace(cmd)); err != nil {
				return err
			}
		}
		return nil
	}
	return app.interactive()
}

type shellApp struct {
	opts   options
	store  *localStore
	remote writableRemote
}

func (a *shellApp) interactive() error {
	printHelp()
	scanner := bufio.NewScanner(os.Stdin)
	for {
		fmt.Printf("%s> ", a.store.state.DeviceID)
		if !scanner.Scan() {
			return scanner.Err()
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if line == "exit" || line == "quit" {
			return nil
		}
		if err := a.runLine(line); err != nil {
			fmt.Println("error:", err)
		}
	}
}

func (a *shellApp) runLine(line string) error {
	fields := strings.Fields(line)
	if len(fields) == 0 {
		return nil
	}
	cmd := fields[0]
	args := fields[1:]
	switch cmd {
	case "help", "?":
		printHelp()
	case "create", "add":
		if len(args) == 0 {
			return errors.New("usage: create <text>")
		}
		rec, err := a.store.create(strings.Join(args, " "))
		if err != nil {
			return err
		}
		fmt.Printf("created %s\n", rec.ID)
	case "update", "edit":
		if len(args) < 2 {
			return errors.New("usage: update <id> <text>")
		}
		if err := a.store.update(args[0], strings.Join(args[1:], " ")); err != nil {
			return err
		}
		fmt.Printf("updated %s\n", args[0])
	case "delete", "del", "rm":
		if len(args) != 1 {
			return errors.New("usage: delete <id>")
		}
		if err := a.store.delete(args[0]); err != nil {
			return err
		}
		fmt.Printf("deleted %s\n", args[0])
	case "list", "ls":
		a.store.printRecords(false)
	case "list-all", "lsa":
		a.store.printRecords(true)
	case "status":
		a.printStatus()
	case "pull":
		return a.pull()
	case "push":
		return a.push()
	case "sync":
		if err := a.pull(); err != nil {
			return err
		}
		return a.push()
	case "remote":
		return a.printRemote()
	default:
		return fmt.Errorf("unknown command %q", cmd)
	}
	return nil
}

func printHelp() {
	fmt.Println("commands:")
	fmt.Println("  create <text>       create a local record")
	fmt.Println("  update <id> <text>  update a local record")
	fmt.Println("  delete <id>         tombstone a local record")
	fmt.Println("  list                show visible records")
	fmt.Println("  list-all            show visible and deleted records")
	fmt.Println("  status              show local checkpoint and draft count")
	fmt.Println("  pull                pull remote manifest/op segments")
	fmt.Println("  push                push local draft records as an op segment")
	fmt.Println("  sync                pull then push")
	fmt.Println("  remote              show remote manifest")
	fmt.Println("  help                show this help")
	fmt.Println("  exit                quit")
}

func (a *shellApp) printStatus() {
	total := len(a.store.state.Records)
	draft := 0
	deleted := 0
	for _, rec := range a.store.state.Records {
		if rec.SyncStatus == 1 {
			draft++
		}
		if rec.DeletedAt != "" {
			deleted++
		}
	}
	fmt.Printf("checkpoint=%d total=%d draft=%d deleted=%d\n", a.store.state.Checkpoint, total, draft, deleted)
}

func (a *shellApp) pull() error {
	if err := a.remote.Prepare(); err != nil {
		return err
	}
	_, existed, err := synchronizer.ReadManifest(a.remote, a.opts.RootDir)
	if err != nil {
		return err
	}
	if !existed {
		fmt.Println("pull: remote manifest not found")
		return nil
	}
	result, _, nextCheckpoint := synchronizer.BuildRemoteOpTasks(syncTables, a.opts.RootDir, a.localFactory, a.remote, a.store.state.Checkpoint)
	a.printResult("pull", result)
	if len(result.Messages) != 0 {
		return errors.New("pull stopped with messages")
	}
	if err := a.applyRecordTasks(result); err != nil {
		return err
	}
	if nextCheckpoint != a.store.state.Checkpoint {
		a.store.state.Checkpoint = nextCheckpoint
		if err := a.store.save(); err != nil {
			return err
		}
	}
	fmt.Printf("pull: checkpoint=%d\n", a.store.state.Checkpoint)
	return nil
}

func (a *shellApp) push() error {
	if err := a.remote.Prepare(); err != nil {
		return err
	}
	_, existed, err := synchronizer.ReadManifest(a.remote, a.opts.RootDir)
	if err != nil {
		return err
	}
	result, manifest := synchronizer.BuildLocalOpSegment(syncTables, a.opts.RootDir, a.localFactory, a.remote, a.store.state.DeviceID, synchronizer.DefaultSegmentSize)
	a.printResult("push", result)
	if len(result.Messages) != 0 {
		return errors.New("push stopped with messages")
	}
	if len(result.FileOperations) == 0 {
		a.store.state.Checkpoint = manifest.Checkpoint
		return a.store.save()
	}
	currentManifest, currentExists, err := synchronizer.ReadManifest(a.remote, a.opts.RootDir)
	if err != nil {
		return err
	}
	if currentManifest.Checkpoint != result.BaseCheckpoint || currentExists != existed {
		return errors.New("remote manifest changed; run sync again")
	}
	if err := a.remote.WriteFileOperations(result.FileOperations, a.opts.RootDir, !currentExists); err != nil {
		return err
	}
	if err := a.remote.Finalize(fmt.Sprintf("sync smoke %s checkpoint %d", a.store.state.DeviceID, manifest.Checkpoint)); err != nil {
		return err
	}
	if err := a.applyRecordTasks(result); err != nil {
		return err
	}
	a.store.state.Checkpoint = manifest.Checkpoint
	if err := a.store.save(); err != nil {
		return err
	}
	fmt.Printf("push: checkpoint=%d\n", a.store.state.Checkpoint)
	return nil
}

func (a *shellApp) printRemote() error {
	if err := a.remote.Prepare(); err != nil {
		return err
	}
	manifest, existed, err := synchronizer.ReadManifest(a.remote, a.opts.RootDir)
	if err != nil {
		return err
	}
	if !existed {
		fmt.Println("remote manifest not found")
		return nil
	}
	b, err := synchronizer.MarshalManifest(manifest)
	if err != nil {
		return err
	}
	fmt.Println(string(b))
	return nil
}

func (a *shellApp) printResult(label string, result *synchronizer.SynchronizeResult) {
	fmt.Printf("%s: file_ops=%d record_tasks=%d base=%d next=%d messages=%d\n", label, len(result.FileOperations), len(result.RecordTasks), result.BaseCheckpoint, result.NextCheckpoint, len(result.Messages))
	for _, msg := range result.Messages {
		fmt.Printf("%s message[%s]: %s\n", label, msg.Scope, msg.Text)
	}
}

func (a *shellApp) localFactory(synchronizer.TableSynchronizeSetting) synchronizer.LocalClient {
	return a.store
}

func (a *shellApp) applyRecordTasks(result *synchronizer.SynchronizeResult) error {
	for _, task := range result.RecordTasks {
		switch task.Type {
		case "create", "update":
			rec, err := mapToRecord(task.Data)
			if err != nil {
				return err
			}
			rec.SyncStatus = 2
			a.store.upsertRecord(rec)
		case "delete":
			if err := a.store.applyDelete(task.Id); err != nil {
				return err
			}
		case "to_published":
			a.store.setSyncStatus(task.Id, 2)
		case "to_draft":
			a.store.setSyncStatus(task.Id, 1)
		case "conflict":
			return fmt.Errorf("conflict on %s: local=%v remote=%v", task.Id, task.Data["local_last_operation"], task.Data["remote_last_operation"])
		}
	}
	return a.store.save()
}

func openLocalStore(dir string, explicitDeviceID string) (*localStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	store := &localStore{
		dir:  dir,
		path: filepath.Join(dir, "device-state.json"),
	}
	b, err := os.ReadFile(store.path)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		deviceID := explicitDeviceID
		if deviceID == "" {
			deviceID = "device-" + shortHash(dir)
		}
		store.state = localState{
			DeviceID: deviceID,
			NextID:   1,
			Records:  []record{},
		}
		return store, store.save()
	}
	if err := json.Unmarshal(b, &store.state); err != nil {
		return nil, err
	}
	if explicitDeviceID != "" && explicitDeviceID != store.state.DeviceID {
		store.state.DeviceID = explicitDeviceID
	}
	if store.state.DeviceID == "" {
		store.state.DeviceID = "device-" + shortHash(dir)
	}
	if store.state.NextID == 0 {
		store.state.NextID = int64(len(store.state.Records) + 1)
	}
	return store, store.save()
}

func (s *localStore) save() error {
	if err := os.MkdirAll(s.dir, 0755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, b, 0644)
}

func (s *localStore) create(text string) (record, error) {
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
	return rec, s.save()
}

func (s *localStore) update(id string, text string) error {
	idx := s.findIndex(id)
	if idx < 0 {
		return fmt.Errorf("record %s not found", id)
	}
	if s.state.Records[idx].DeletedAt != "" {
		return fmt.Errorf("record %s is deleted", id)
	}
	now := nowMillis()
	s.state.Records[idx].Text = text
	s.state.Records[idx].UpdatedAt = now
	s.state.Records[idx].LastOperationTime = now
	s.state.Records[idx].LastOperationType = 2
	s.state.Records[idx].SyncStatus = 1
	return s.save()
}

func (s *localStore) delete(id string) error {
	idx := s.findIndex(id)
	if idx < 0 {
		return fmt.Errorf("record %s not found", id)
	}
	now := nowMillis()
	s.state.Records[idx].UpdatedAt = now
	s.state.Records[idx].DeletedAt = now
	s.state.Records[idx].LastOperationTime = now
	s.state.Records[idx].LastOperationType = 3
	s.state.Records[idx].SyncStatus = 1
	return s.save()
}

func (s *localStore) applyDelete(id string) error {
	idx := s.findIndex(id)
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
		return nil
	}
	s.state.Records[idx].DeletedAt = now
	s.state.Records[idx].UpdatedAt = now
	s.state.Records[idx].LastOperationType = 3
	s.state.Records[idx].SyncStatus = 2
	return nil
}

func (s *localStore) upsertRecord(rec record) {
	idx := s.findIndex(rec.ID)
	if idx < 0 {
		s.state.Records = append(s.state.Records, rec)
		return
	}
	s.state.Records[idx] = rec
}

func (s *localStore) setSyncStatus(id string, status int) {
	idx := s.findIndex(id)
	if idx >= 0 {
		s.state.Records[idx].SyncStatus = status
	}
}

func (s *localStore) findIndex(id string) int {
	for i, rec := range s.state.Records {
		if rec.ID == id {
			return i
		}
	}
	return -1
}

func (s *localStore) printRecords(showDeleted bool) {
	records := make([]record, 0, len(s.state.Records))
	for _, rec := range s.state.Records {
		if !showDeleted && rec.DeletedAt != "" {
			continue
		}
		records = append(records, rec)
	}
	sort.Slice(records, func(i, j int) bool {
		return records[i].LastOperationTime < records[j].LastOperationTime
	})
	for _, rec := range records {
		status := "synced"
		if rec.SyncStatus == 1 {
			status = "draft"
		}
		if rec.DeletedAt != "" {
			status += ",deleted"
		}
		fmt.Printf("%s [%s] %s\n", rec.ID, status, rec.Text)
	}
	if len(records) == 0 {
		fmt.Println("(empty)")
	}
}

func (s *localStore) FetchTableLastDraftRecord() (map[string]interface{}, error) {
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

func (s *localStore) FetchUniqueDaysOfTable() []string {
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

func (s *localStore) FetchRecordsBetweenSpecialDayOfTable(day string) ([]map[string]interface{}, error) {
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

func (s *localStore) FetchRecordCountBetweenSpecialDayOfTable(day string) (int64, error) {
	records, err := s.FetchRecordsBetweenSpecialDayOfTable(day)
	return int64(len(records)), err
}

func (s *localStore) FetchRecordOrderByTimeAndBetweenStartAndEndOfTable(day string) ([]map[string]interface{}, error) {
	return s.FetchRecordsBetweenSpecialDayOfTable(day)
}

func (s *localStore) FetchRecordById(id string) ([]map[string]interface{}, error) {
	idx := s.findIndex(id)
	if idx < 0 {
		return []map[string]interface{}{}, nil
	}
	return []map[string]interface{}{s.state.Records[idx].toMap()}, nil
}

func (s *localStore) FetchAllRecords() ([]map[string]interface{}, error) {
	records := make([]map[string]interface{}, 0, len(s.state.Records))
	for _, rec := range s.state.Records {
		records = append(records, rec.toMap())
	}
	return records, nil
}

func (s *localStore) SetRecords(v []map[string]interface{}) {
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

func newWebDAVRemote(opts options) (*webDAVRemote, error) {
	if opts.WebDAVURL == "" {
		return nil, errors.New("--webdav-url is required for --remote webdav")
	}
	client := gowebdav.NewClient(opts.WebDAVURL, opts.WebDAVUsername, opts.WebDAVPassword)
	if err := client.Connect(); err != nil {
		return nil, err
	}
	return &webDAVRemote{client: client}, nil
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

func newGitRemote(opts options) (*gitRemote, error) {
	if opts.GitRepo == "" {
		return nil, errors.New("--git-repo is required for --remote git")
	}
	r := &gitRemote{repo: opts.GitRepo, push: opts.GitPush}
	if err := os.MkdirAll(opts.GitRepo, 0755); err != nil {
		return nil, err
	}
	if _, err := os.Stat(filepath.Join(opts.GitRepo, ".git")); os.IsNotExist(err) {
		if err := r.git("init"); err != nil {
			return nil, err
		}
	}
	_ = r.git("config", "user.email", "sync-smoke@example.local")
	_ = r.git("config", "user.name", "Sync Smoke Device")
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

func openRemote(opts options) (writableRemote, error) {
	switch opts.RemoteKind {
	case "webdav":
		return newWebDAVRemote(opts)
	case "git":
		return newGitRemote(opts)
	default:
		return nil, fmt.Errorf("unsupported --remote %q", opts.RemoteKind)
	}
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
