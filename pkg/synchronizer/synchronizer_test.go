package synchronizer_test

import (
	"encoding/json"
	"fmt"
	"path"
	"testing"

	"devboard/pkg/fsmock"
	"devboard/pkg/synchronizer"
)

var local_records = []map[string]interface{}{
	{
		"id": "e",
		// 2025-10-13 12:01
		"last_operation_time": "1760328060000",
		"created_at":          "1760328060000",
	},
	{
		"id": "d",
		// 2025-10-12 12:11
		"last_operation_time": "1760242200000",
		"created_at":          "1760242200000",
	},
	{

		"id": "c",
		// 2025-10-12 12:10
		"last_operation_time": "1760242200000",
		"created_at":          "1760242200000",
	},
	{
		"id":                  "b",
		"last_operation_time": "1760241600000",
		// 2025-10-12 12:01
		"created_at": "1760241600000",
	},
	{
		"id":                  "a",
		"last_operation_time": "1760241600000",
		// 2025-10-12 12:00
		"created_at": "1760241600000",
	},
}

func TestBuildLocalToRemoteTasks(t *testing.T) {
	local_client := synchronizer.NewMockLocalClient("paste_event")

	local_client.SetRecords(local_records)
	remote_client := synchronizer.NewMockRemoteClient()
	l1, _ := json.Marshal(local_records[4])
	l2, _ := json.Marshal(local_records[3])
	fsys := fsmock.New(fsmock.NewDir("",
		fsmock.NewDir("devboard",
			fsmock.TextFile("meta", ""),
			fsmock.NewDir("paste_event",
				fsmock.TextFile("meta", "1760182920000\n2025-10-11 1760182920000"),
				fsmock.TextFile("2025-10-12", string(l1)+"\n"+string(l2)),
			),
		),
	))
	remote_client.SetFS(fsys)
	result := synchronizer.BuildLocalSyncToRemoteTasks("paste_event", "/devboard", local_client, remote_client)
	for _, log := range result.Logs {
		fmt.Println(log)
	}
	if len(result.FileTasks) != 9 {
		t.Errorf("最终文件任务数不匹配:\n得到: %v\n期望: %v", len(result.FileTasks), 9)
	}
	// for _, op := range result.FileTasks {
	// 	fmt.Println(op.Type)
	// 	fmt.Println(op.Content)
	// }
	if len(result.FileOperations) != 3 {
		t.Errorf("最终文件操作数不匹配:\n得到: %v\n期望: %v", len(result.FileOperations), 3)
	}
	for _, op := range result.FileOperations {
		fmt.Println(op)
	}

	t.Errorf("end?")
	// first := result.FileOperations[0]
	// if first.Type != "update_file" {

	// }
	// resOp := result[i]
	// expOp := tt.expected[i]

	// if resOp.Type != expOp.Type {
	// 	t.Errorf("操作 #%d 类型不匹配:\n得到: %s\n期望: %s", i+1, resOp.Type, expOp.Type)
	// }

	// if resOp.Filepath != expOp.Filepath {
	// 	t.Errorf("操作 #%d 文件路径不匹配:\n得到: %s\n期望: %s", i+1, resOp.Filepath, expOp.Filepath)
	// }

	// if resOp.Content != expOp.Content {
	// 	t.Errorf("操作 #%d 内容不匹配:\n得到: %q\n期望: %q", i+1, resOp.Content, expOp.Content)
	// }
}

func walk(root_dir string, fs *fsmock.FS) {
	dirs, err := fs.ReadDir(root_dir)
	if err != nil {
		fmt.Println("[ERROR]read dir failed", err.Error())
		return
	}
	for _, dir := range dirs {
		ff := path.Join(root_dir, dir.Name())
		fmt.Println(dir.Name(), ff, dir.IsDir())
		if dir.IsDir() {
			walk(ff, fs)
		}
	}
}
