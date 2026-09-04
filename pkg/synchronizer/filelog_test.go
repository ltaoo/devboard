package synchronizer_test

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"testing"

	"devboard/pkg/fsmock"
	"devboard/pkg/synchronizer"
)

func TestBuildLocalOpSegmentCreatesManifestAndImmutableSegment(t *testing.T) {
	localClient := synchronizer.NewMockLocalClient("paste_event")
	localClient.SetRecords([]map[string]interface{}{
		{
			"id":                  "a",
			"sync_status":         int64(1),
			"last_operation_type": int64(1),
			"last_operation_time": "1760241600000",
			"created_at":          "1760241600000",
			"text":                "hello",
		},
	})
	remoteClient := synchronizer.NewMockRemoteClient()
	remoteClient.SetFS(fsmock.New(fsmock.NewDir("", fsmock.NewDir("devboard"))))

	settings := []synchronizer.TableSynchronizeSetting{{
		Name:        "paste_event",
		IdFieldName: "id",
	}}
	result, manifest := synchronizer.BuildLocalOpSegment(
		settings,
		"/devboard",
		func(synchronizer.TableSynchronizeSetting) synchronizer.LocalClient { return localClient },
		remoteClient,
		"device-a",
		1000,
	)

	if len(result.Messages) != 0 {
		t.Fatalf("unexpected messages: %#v", result.Messages)
	}
	if manifest.Checkpoint != 1 {
		t.Fatalf("manifest checkpoint = %d, want 1", manifest.Checkpoint)
	}
	if len(manifest.Segments) != 1 {
		t.Fatalf("segments = %d, want 1", len(manifest.Segments))
	}
	if got := len(result.FileOperations); got != 2 {
		t.Fatalf("file operations = %d, want 2", got)
	}
	if result.FileOperations[0].Filepath != "/devboard/ops/segment-000000000001-000000000001.jsonl" {
		t.Fatalf("unexpected segment path: %s", result.FileOperations[0].Filepath)
	}
	if result.FileOperations[1].Filepath != "/devboard/manifest.json" {
		t.Fatalf("unexpected manifest path: %s", result.FileOperations[1].Filepath)
	}
	var op synchronizer.SyncOperation
	if err := json.Unmarshal([]byte(strings.TrimSpace(result.FileOperations[0].Content)), &op); err != nil {
		t.Fatal(err)
	}
	if op.OpID != "device-a:paste_event:a:1760241600000" {
		t.Fatalf("op id = %s", op.OpID)
	}
	if op.Seq != 1 || op.Table != "paste_event" || op.RecordID != "a" {
		t.Fatalf("unexpected op: %#v", op)
	}
	if len(result.RecordTasks) != 1 || result.RecordTasks[0].Type != "to_published" {
		t.Fatalf("unexpected record tasks: %#v", result.RecordTasks)
	}
}

func TestBuildRemoteOpTasksCreatesRecordTasksFromManifest(t *testing.T) {
	segment := `{"op_id":"device-a:paste_event:a:1760241600000","seq":1,"device_id":"device-a","table":"paste_event","record_id":"a","action":"put","record_revision":"rev-1760241600000-device-a","last_operation_time":"1760241600000","created_at":"1760241600000","data":{"id":"a","sync_status":1,"last_operation_type":1,"last_operation_time":"1760241600000","created_at":"1760241600000","text":"hello"},"client_time":1760241600000}`
	manifest := synchronizer.Manifest{
		Schema:     1,
		Revision:   "r1",
		Checkpoint: 1,
		Segments: []synchronizer.SegmentMeta{{
			From:   1,
			To:     1,
			Path:   "/devboard/ops/segment-000000000001-000000000001.jsonl",
			SHA256: sha256ForTest(segment),
			Count:  1,
		}},
	}
	manifestBytes, err := synchronizer.MarshalManifest(manifest)
	if err != nil {
		t.Fatal(err)
	}
	localClient := synchronizer.NewMockLocalClient("paste_event")
	localClient.SetRecords(nil)
	remoteClient := synchronizer.NewMockRemoteClient()
	remoteClient.SetFS(fsmock.New(fsmock.NewDir("",
		fsmock.NewDir("devboard",
			fsmock.TextFile("manifest.json", string(manifestBytes)),
			fsmock.NewDir("ops",
				fsmock.TextFile("segment-000000000001-000000000001.jsonl", segment),
			),
		),
	)))

	result, _, checkpoint := synchronizer.BuildRemoteOpTasks(
		[]synchronizer.TableSynchronizeSetting{{Name: "paste_event", IdFieldName: "id"}},
		"/devboard",
		func(synchronizer.TableSynchronizeSetting) synchronizer.LocalClient { return localClient },
		remoteClient,
		0,
	)

	if checkpoint != 1 {
		t.Fatalf("checkpoint = %d, want 1", checkpoint)
	}
	if len(result.Messages) != 0 {
		t.Fatalf("unexpected messages: %#v", result.Messages)
	}
	if len(result.RecordTasks) != 1 {
		t.Fatalf("record tasks = %d, want 1", len(result.RecordTasks))
	}
	if result.RecordTasks[0].Type != "create" || result.RecordTasks[0].Data["table"] != "paste_event" {
		t.Fatalf("unexpected task: %#v", result.RecordTasks[0])
	}
}

func TestBuildRemoteOpTasksDetectsUnsyncedLocalConflict(t *testing.T) {
	segment := `{"op_id":"device-b:paste_event:a:1760241700000","seq":1,"device_id":"device-b","table":"paste_event","record_id":"a","action":"put","record_revision":"rev-1760241700000-device-b","last_operation_time":"1760241700000","created_at":"1760241600000","data":{"id":"a","sync_status":1,"last_operation_type":2,"last_operation_time":"1760241700000","created_at":"1760241600000","text":"remote"},"client_time":1760241700000}`
	manifest := synchronizer.Manifest{
		Schema:     1,
		Revision:   "r1",
		Checkpoint: 1,
		Segments: []synchronizer.SegmentMeta{{
			From:   1,
			To:     1,
			Path:   "/devboard/ops/segment-000000000001-000000000001.jsonl",
			SHA256: sha256ForTest(segment),
			Count:  1,
		}},
	}
	manifestBytes, err := synchronizer.MarshalManifest(manifest)
	if err != nil {
		t.Fatal(err)
	}
	localClient := synchronizer.NewMockLocalClient("paste_event")
	localClient.SetRecords([]map[string]interface{}{
		{
			"id":                  "a",
			"sync_status":         int64(1),
			"last_operation_type": int64(2),
			"last_operation_time": "1760241650000",
			"created_at":          "1760241600000",
			"text":                "local",
		},
	})
	remoteClient := synchronizer.NewMockRemoteClient()
	remoteClient.SetFS(fsmock.New(fsmock.NewDir("",
		fsmock.NewDir("devboard",
			fsmock.TextFile("manifest.json", string(manifestBytes)),
			fsmock.NewDir("ops",
				fsmock.TextFile("segment-000000000001-000000000001.jsonl", segment),
			),
		),
	)))

	result, _, _ := synchronizer.BuildRemoteOpTasks(
		[]synchronizer.TableSynchronizeSetting{{Name: "paste_event", IdFieldName: "id"}},
		"/devboard",
		func(synchronizer.TableSynchronizeSetting) synchronizer.LocalClient { return localClient },
		remoteClient,
		0,
	)

	if len(result.RecordTasks) != 1 {
		t.Fatalf("record tasks = %d, want 1", len(result.RecordTasks))
	}
	if result.RecordTasks[0].Type != "conflict" {
		t.Fatalf("task type = %s, want conflict", result.RecordTasks[0].Type)
	}
}

func sha256ForTest(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}
