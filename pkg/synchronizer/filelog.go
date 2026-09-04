package synchronizer

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	ManifestFilename = "manifest.json"
	SnapshotDirname  = "snapshots"
	OpsDirname       = "ops"

	DefaultSegmentSize = 1000
)

type Manifest struct {
	Schema     int           `json:"schema"`
	Revision   string        `json:"revision"`
	Checkpoint int64         `json:"checkpoint"`
	Snapshot   *SnapshotMeta `json:"snapshot,omitempty"`
	Segments   []SegmentMeta `json:"op_segments"`
	UpdatedAt  int64         `json:"updated_at"`
}

type SnapshotMeta struct {
	Checkpoint int64  `json:"checkpoint"`
	Path       string `json:"path"`
	SHA256     string `json:"sha256"`
}

type SegmentMeta struct {
	From   int64  `json:"from"`
	To     int64  `json:"to"`
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Count  int    `json:"count"`
}

type SyncOperation struct {
	OpID              string                 `json:"op_id"`
	Seq               int64                  `json:"seq"`
	DeviceID          string                 `json:"device_id"`
	Table             string                 `json:"table"`
	RecordID          string                 `json:"record_id"`
	Action            string                 `json:"action"`
	BaseRevision      string                 `json:"base_revision,omitempty"`
	RecordRevision    string                 `json:"record_revision"`
	LastOperationTime string                 `json:"last_operation_time,omitempty"`
	CreatedAt         string                 `json:"created_at,omitempty"`
	Data              map[string]interface{} `json:"data,omitempty"`
	DeletedAt         interface{}            `json:"deleted_at,omitempty"`
	ClientTime        int64                  `json:"client_time"`
}

type Snapshot struct {
	Schema     int                                          `json:"schema"`
	Checkpoint int64                                        `json:"checkpoint"`
	Tables     map[string]map[string]map[string]interface{} `json:"tables"`
	CreatedAt  int64                                        `json:"created_at"`
}

func NewEmptyManifest(now int64) Manifest {
	return Manifest{
		Schema:     1,
		Revision:   "r0",
		Checkpoint: 0,
		Segments:   []SegmentMeta{},
		UpdatedAt:  now,
	}
}

func ReadManifest(remote RemoteClient, rootDir string) (Manifest, bool, error) {
	manifestPath := path.Join(rootDir, ManifestFilename)
	b, err := remote.Read(manifestPath)
	if err != nil {
		if remote.IsErrNotFound(err) {
			return NewEmptyManifest(time.Now().UnixMilli()), false, nil
		}
		return Manifest{}, false, err
	}
	var manifest Manifest
	if err := json.Unmarshal(b, &manifest); err != nil {
		return Manifest{}, true, fmt.Errorf("parse manifest failed: %w", err)
	}
	if manifest.Schema == 0 {
		manifest.Schema = 1
	}
	if manifest.Segments == nil {
		manifest.Segments = []SegmentMeta{}
	}
	return manifest, true, nil
}

func MarshalManifest(manifest Manifest) ([]byte, error) {
	return json.MarshalIndent(manifest, "", "  ")
}

func BuildLocalOpSegment(
	settings []TableSynchronizeSetting,
	rootDir string,
	localFactory func(TableSynchronizeSetting) LocalClient,
	remote RemoteClient,
	deviceID string,
	segmentSize int,
) (*SynchronizeResult, Manifest) {
	result := SynchronizeResult{
		Logs:           []string{},
		Messages:       []*SynchronizeMessage{},
		FileTasks:      []*FileTask{},
		FileOperations: []*FileOperation{},
		RecordTasks:    []*RecordTask{},
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	addMessage := func(msg *SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	addFileOperation := func(op *FileOperation) {
		result.FileOperations = append(result.FileOperations, op)
	}
	addRecordTask := func(task *RecordTask) {
		result.RecordTasks = append(result.RecordTasks, task)
	}

	if segmentSize <= 0 {
		segmentSize = DefaultSegmentSize
	}
	now := time.Now().UnixMilli()
	manifest, existed, err := ReadManifest(remote, rootDir)
	if err != nil {
		log("[ERROR]read manifest failed, " + err.Error())
		addMessage(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "webdav",
			Text:  err.Error(),
		})
		return &result, manifest
	}
	if !existed {
		log("[LOG]manifest not found, create a new manifest")
	}
	result.BaseCheckpoint = manifest.Checkpoint

	pending, err := collectPendingOperations(settings, localFactory, deviceID)
	if err != nil {
		log("[ERROR]collect pending ops failed, " + err.Error())
		addMessage(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "database",
			Text:  err.Error(),
		})
		return &result, manifest
	}
	if len(pending) == 0 {
		log("[LOG]no pending local ops")
		return &result, manifest
	}

	nextManifest := manifest
	nextManifest.UpdatedAt = now
	cursor := manifest.Checkpoint
	for from := 0; from < len(pending); from += segmentSize {
		to := from + segmentSize
		if to > len(pending) {
			to = len(pending)
		}
		batch := pending[from:to]
		for i := range batch {
			cursor++
			batch[i].Seq = cursor
		}
		content, err := encodeJSONLines(batch)
		if err != nil {
			log("[ERROR]encode op segment failed, " + err.Error())
			addMessage(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "JSON Marshal",
				Text:  err.Error(),
			})
			return &result, manifest
		}
		segmentPath := path.Join(rootDir, OpsDirname, fmt.Sprintf("segment-%012d-%012d.jsonl", batch[0].Seq, batch[len(batch)-1].Seq))
		sum := sha256Hex([]byte(content))
		nextManifest.Segments = append(nextManifest.Segments, SegmentMeta{
			From:   batch[0].Seq,
			To:     batch[len(batch)-1].Seq,
			Path:   segmentPath,
			SHA256: sum,
			Count:  len(batch),
		})
		addFileOperation(&FileOperation{
			Type:     "new_file",
			Filepath: segmentPath,
			Content:  content,
		})
		for _, op := range batch {
			addRecordTask(&RecordTask{
				Type: "to_published",
				Id:   op.RecordID,
				Data: map[string]interface{}{"table": op.Table},
			})
		}
	}
	nextManifest.Checkpoint = cursor
	nextManifest.Revision = fmt.Sprintf("r%d", nextManifest.Checkpoint)
	result.NextCheckpoint = nextManifest.Checkpoint
	manifestBytes, err := MarshalManifest(nextManifest)
	if err != nil {
		log("[ERROR]encode manifest failed, " + err.Error())
		addMessage(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "JSON Marshal",
			Text:  err.Error(),
		})
		return &result, manifest
	}
	addFileOperation(&FileOperation{
		Type:     manifestOperationType(existed),
		Filepath: path.Join(rootDir, ManifestFilename),
		Content:  string(manifestBytes),
	})
	log("[LOG]built immutable op segments, count " + strconv.Itoa(len(nextManifest.Segments)-len(manifest.Segments)))
	return &result, nextManifest
}

func BuildRemoteOpTasks(
	settings []TableSynchronizeSetting,
	rootDir string,
	localFactory func(TableSynchronizeSetting) LocalClient,
	remote RemoteClient,
	localCheckpoint int64,
) (*SynchronizeResult, Manifest, int64) {
	result := SynchronizeResult{
		Logs:        []string{},
		Messages:    []*SynchronizeMessage{},
		RecordTasks: []*RecordTask{},
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	addMessage := func(msg *SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	addRecordTask := func(task *RecordTask) {
		result.RecordTasks = append(result.RecordTasks, task)
	}

	manifest, existed, err := ReadManifest(remote, rootDir)
	if err != nil {
		log("[ERROR]read manifest failed, " + err.Error())
		addMessage(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "webdav",
			Text:  err.Error(),
		})
		return &result, manifest, localCheckpoint
	}
	result.BaseCheckpoint = localCheckpoint
	if !existed {
		log("[ERROR]manifest not found")
		addMessage(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "webdav",
			Text:  "未找到 manifest.json",
		})
		return &result, manifest, localCheckpoint
	}

	tableSettings := map[string]TableSynchronizeSetting{}
	for _, setting := range settings {
		tableSettings[setting.Name] = setting
	}
	tableRecordCache := map[string]map[string]map[string]interface{}{}
	nextCheckpoint := localCheckpoint
	for _, segment := range manifest.Segments {
		if segment.To <= localCheckpoint {
			continue
		}
		content, err := remote.Read(segment.Path)
		if err != nil {
			log("[ERROR]read segment failed, " + err.Error())
			addMessage(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "webdav",
				Text:  err.Error(),
			})
			return &result, manifest, nextCheckpoint
		}
		if sum := sha256Hex(content); sum != segment.SHA256 {
			err := fmt.Errorf("segment checksum mismatch: %s", segment.Path)
			log("[ERROR]" + err.Error())
			addMessage(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "webdav",
				Text:  err.Error(),
			})
			return &result, manifest, nextCheckpoint
		}
		ops, err := decodeJSONLines(content)
		if err != nil {
			log("[ERROR]parse segment failed, " + err.Error())
			addMessage(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "JSON Unmarshal",
				Text:  err.Error(),
			})
			return &result, manifest, nextCheckpoint
		}
		for _, op := range ops {
			if op.Seq <= localCheckpoint {
				continue
			}
			setting, ok := tableSettings[op.Table]
			if !ok {
				log("[LOG]skip op for unmanaged table " + op.Table)
				if op.Seq > nextCheckpoint {
					nextCheckpoint = op.Seq
				}
				continue
			}
			localRecord, err := cachedLocalRecord(tableRecordCache, localFactory, setting, op.RecordID)
			if err != nil {
				log("[ERROR]fetch local record failed, " + err.Error())
				addMessage(&SynchronizeMessage{
					Type:  SynchronizeMessageError,
					Scope: "database",
					Text:  err.Error(),
				})
				return &result, manifest, nextCheckpoint
			}
			task := operationToRecordTask(op, localRecord)
			if task != nil {
				addRecordTask(task)
				putCachedLocalRecord(tableRecordCache, op.Table, op.RecordID, op.Data)
			}
			if op.Seq > nextCheckpoint {
				nextCheckpoint = op.Seq
			}
		}
	}
	result.NextCheckpoint = nextCheckpoint
	return &result, manifest, nextCheckpoint
}

func BuildSnapshotOperations(
	settings []TableSynchronizeSetting,
	rootDir string,
	localFactory func(TableSynchronizeSetting) LocalClient,
	remote RemoteClient,
	manifest Manifest,
) (*SynchronizeResult, Manifest) {
	result := SynchronizeResult{
		Logs:           []string{},
		Messages:       []*SynchronizeMessage{},
		FileOperations: []*FileOperation{},
	}
	log := func(content string) {
		result.Logs = append(result.Logs, content)
	}
	addMessage := func(msg *SynchronizeMessage) {
		result.Messages = append(result.Messages, msg)
	}
	addFileOperation := func(op *FileOperation) {
		result.FileOperations = append(result.FileOperations, op)
	}

	tables := map[string]map[string]map[string]interface{}{}
	for _, setting := range settings {
		local := localFactory(setting)
		records := map[string]map[string]interface{}{}
		tableRecords, err := local.FetchAllRecords()
		if err != nil {
			log("[ERROR]fetch records failed, " + err.Error())
			addMessage(&SynchronizeMessage{
				Type:  SynchronizeMessageError,
				Scope: "database",
				Text:  err.Error(),
			})
			return &result, manifest
		}
		for _, record := range tableRecords {
			id, ok := stringValue(record[setting.IdFieldName])
			if !ok || id == "" {
				continue
			}
			records[id] = normalizeRecord(record)
		}
		tables[setting.Name] = records
	}
	snapshot := Snapshot{
		Schema:     1,
		Checkpoint: manifest.Checkpoint,
		Tables:     tables,
		CreatedAt:  time.Now().UnixMilli(),
	}
	content, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		log("[ERROR]encode snapshot failed, " + err.Error())
		addMessage(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "JSON Marshal",
			Text:  err.Error(),
		})
		return &result, manifest
	}
	snapshotPath := path.Join(rootDir, SnapshotDirname, fmt.Sprintf("snapshot-%012d.json", manifest.Checkpoint))
	sum := sha256Hex(content)
	nextManifest := manifest
	nextManifest.Snapshot = &SnapshotMeta{
		Checkpoint: manifest.Checkpoint,
		Path:       snapshotPath,
		SHA256:     sum,
	}
	nextManifest.UpdatedAt = time.Now().UnixMilli()
	manifestBytes, err := MarshalManifest(nextManifest)
	if err != nil {
		log("[ERROR]encode manifest failed, " + err.Error())
		addMessage(&SynchronizeMessage{
			Type:  SynchronizeMessageError,
			Scope: "JSON Marshal",
			Text:  err.Error(),
		})
		return &result, manifest
	}
	addFileOperation(&FileOperation{
		Type:     "new_file",
		Filepath: snapshotPath,
		Content:  string(content),
	})
	addFileOperation(&FileOperation{
		Type:     "update_file",
		Filepath: path.Join(rootDir, ManifestFilename),
		Content:  string(manifestBytes),
	})
	return &result, nextManifest
}

func collectPendingOperations(settings []TableSynchronizeSetting, localFactory func(TableSynchronizeSetting) LocalClient, deviceID string) ([]SyncOperation, error) {
	if deviceID == "" {
		deviceID = "unknown-device"
	}
	var ops []SyncOperation
	for _, setting := range settings {
		local := localFactory(setting)
		days := local.FetchUniqueDaysOfTable()
		for _, day := range days {
			records, err := local.FetchRecordsBetweenSpecialDayOfTable(day)
			if err != nil {
				return nil, err
			}
			for _, record := range records {
				if !isDraftRecord(record) {
					continue
				}
				id, ok := stringValue(record[setting.IdFieldName])
				if !ok || id == "" {
					continue
				}
				op := recordToOperation(setting, record, deviceID, id)
				ops = append(ops, op)
			}
		}
	}
	sort.SliceStable(ops, func(i, j int) bool {
		if ops[i].LastOperationTime == ops[j].LastOperationTime {
			if ops[i].Table == ops[j].Table {
				return ops[i].RecordID < ops[j].RecordID
			}
			return ops[i].Table < ops[j].Table
		}
		return ops[i].LastOperationTime < ops[j].LastOperationTime
	})
	return ops, nil
}

func recordToOperation(setting TableSynchronizeSetting, record map[string]interface{}, deviceID string, id string) SyncOperation {
	data := normalizeRecord(record)
	lastOperationTime, _ := stringValue(record["last_operation_time"])
	createdAt, _ := stringValue(record["created_at"])
	action := "put"
	if isDeleteRecord(record) {
		action = "delete"
	}
	revision := buildRecordRevision(lastOperationTime, deviceID)
	return SyncOperation{
		OpID:              deviceID + ":" + setting.Name + ":" + id + ":" + lastOperationTime,
		DeviceID:          deviceID,
		Table:             setting.Name,
		RecordID:          id,
		Action:            action,
		RecordRevision:    revision,
		LastOperationTime: lastOperationTime,
		CreatedAt:         createdAt,
		Data:              data,
		DeletedAt:         record["deleted_at"],
		ClientTime:        time.Now().UnixMilli(),
	}
}

func operationToRecordTask(op SyncOperation, local map[string]interface{}) *RecordTask {
	if local != nil {
		localLOT, _ := stringValue(local["last_operation_time"])
		if localLOT != "" && op.LastOperationTime != "" {
			if localLOT != op.LastOperationTime && isDraftRecord(local) {
				return &RecordTask{
					Type: "conflict",
					Id:   op.RecordID,
					Data: map[string]interface{}{
						"table":                 op.Table,
						"remote_last_operation": op.LastOperationTime,
						"local_last_operation":  localLOT,
					},
				}
			}
			localTime, err1 := strconv.ParseInt(localLOT, 10, 64)
			remoteTime, err2 := strconv.ParseInt(op.LastOperationTime, 10, 64)
			if err1 == nil && err2 == nil && localTime > remoteTime {
				return &RecordTask{
					Type: "to_draft",
					Id:   op.RecordID,
					Data: map[string]interface{}{"table": op.Table},
				}
			}
			if localLOT == op.LastOperationTime {
				return &RecordTask{
					Type: "to_published",
					Id:   op.RecordID,
					Data: map[string]interface{}{"table": op.Table},
				}
			}
		}
	}
	if op.Action == "delete" {
		return &RecordTask{
			Type: "delete",
			Id:   op.RecordID,
			Data: map[string]interface{}{"table": op.Table},
		}
	}
	data := normalizeRecord(op.Data)
	data["table"] = op.Table
	data["sync_status"] = 2
	if local == nil {
		return &RecordTask{
			Type: "create",
			Id:   op.RecordID,
			Data: data,
		}
	}
	return &RecordTask{
		Type: "update",
		Id:   op.RecordID,
		Data: data,
	}
}

func cachedLocalRecord(cache map[string]map[string]map[string]interface{}, localFactory func(TableSynchronizeSetting) LocalClient, setting TableSynchronizeSetting, id string) (map[string]interface{}, error) {
	if tableCache, ok := cache[setting.Name]; ok {
		if record, ok := tableCache[id]; ok {
			return record, nil
		}
	}
	local := localFactory(setting)
	records, err := local.FetchRecordById(id)
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		putCachedLocalRecord(cache, setting.Name, id, nil)
		return nil, nil
	}
	putCachedLocalRecord(cache, setting.Name, id, records[0])
	return records[0], nil
}

func putCachedLocalRecord(cache map[string]map[string]map[string]interface{}, table string, id string, record map[string]interface{}) {
	tableCache := cache[table]
	if tableCache == nil {
		tableCache = map[string]map[string]interface{}{}
		cache[table] = tableCache
	}
	tableCache[id] = record
}

func encodeJSONLines(ops []SyncOperation) (string, error) {
	lines := make([]string, 0, len(ops))
	for _, op := range ops {
		b, err := json.Marshal(op)
		if err != nil {
			return "", err
		}
		lines = append(lines, string(b))
	}
	return strings.Join(lines, "\n"), nil
}

func decodeJSONLines(content []byte) ([]SyncOperation, error) {
	lines := SplitToLines(content)
	ops := make([]SyncOperation, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var op SyncOperation
		if err := json.Unmarshal([]byte(line), &op); err != nil {
			return nil, err
		}
		ops = append(ops, op)
	}
	return ops, nil
}

func normalizeRecord(record map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(record))
	for k, v := range record {
		out[k] = v
	}
	return out
}

func isDraftRecord(record map[string]interface{}) bool {
	v, ok := intValue(record["sync_status"])
	return ok && v == 1
}

func isDeleteRecord(record map[string]interface{}) bool {
	v, ok := intValue(record["last_operation_type"])
	if ok && v == 3 {
		return true
	}
	if deletedAt, ok := record["deleted_at"]; ok && deletedAt != nil {
		if s, ok := stringValue(deletedAt); ok {
			return s != "" && s != "0001-01-01T00:00:00Z"
		}
		return true
	}
	return false
}

func intValue(v interface{}) (int64, bool) {
	switch t := v.(type) {
	case int:
		return int64(t), true
	case int8:
		return int64(t), true
	case int16:
		return int64(t), true
	case int32:
		return int64(t), true
	case int64:
		return t, true
	case uint:
		return int64(t), true
	case uint8:
		return int64(t), true
	case uint16:
		return int64(t), true
	case uint32:
		return int64(t), true
	case uint64:
		return int64(t), true
	case float64:
		return int64(t), true
	case string:
		i, err := strconv.ParseInt(t, 10, 64)
		return i, err == nil
	default:
		return 0, false
	}
}

func stringValue(v interface{}) (string, bool) {
	switch t := v.(type) {
	case string:
		return t, true
	case []byte:
		return string(t), true
	case int:
		return strconv.FormatInt(int64(t), 10), true
	case int64:
		return strconv.FormatInt(t, 10), true
	case float64:
		return strconv.FormatInt(int64(t), 10), true
	default:
		return "", false
	}
}

func buildRecordRevision(lastOperationTime string, deviceID string) string {
	if lastOperationTime == "" {
		lastOperationTime = strconv.FormatInt(time.Now().UnixMilli(), 10)
	}
	return "rev-" + lastOperationTime + "-" + deviceID
}

func sha256Hex(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

func manifestOperationType(existed bool) string {
	if existed {
		return "update_file"
	}
	return "new_file"
}
