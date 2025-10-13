package synchronizer_test

import (
	"testing"

	"devboard/pkg/synchronizer"
)

// 目的
// 尽量少的 webdav 调用次数
// 尽量小的文件存储

// d
// c
// b
// a

// 实际情况来说
// 最简单的，今天创建了两条记录 a b，在 2025-10-13 12:00 第一次同步，paste_event/meta 中没有 2025-10-13 行，那么本地所有记录，都是新增
// 得到如下 FileTask
// 1. new_file 2025-10-13
// 2. append_line 2025-10-13 <b>
// 3. append_line 2025-10-13 <a>
// 4. update_file paste_event/meta <2025-10-12 21:51 2025-10-12 2025-10-12 21:51>
// 5. update_line paste_event/meta 0 <2025-10-13 12:00>
// 6. append_line paste_event/meta <2025-10-13 2025-10-13 12:00>
// 创建 file_operation
// 1. new_file 2025-10-13 <b a>
// 2. update_file 2025-10-13 <2025-10-13 12:00 2025-10-12 2025-10-12 21:51 2025-10-13 2025-10-13 12:00>

// 然后，新增了一些记录后 c d，并且编辑了 a，在 2025-10-13 12:10 进行第二次同步，首先查看 paste_event/meta
// 存在 2025-10-13 行，记录行数2，并且其 last_operation_time 2025-10-13 12:00，早于本地 last_operation_time 2025-10-13 12:10
// 说明可以 local to remote
// 遍历 2025-10-13 查询到的所有本地记录，遍历，并判断记录是否已存在于 2025-10-13 文件
// 如果不存在，说明是新增
// （上面说了新增了一些记录，所以肯定这里存在新增）创建一个 FileTask append_line 2025-10-13 <d>
// 创建一个 FileTask append_line 2025-10-13 <c>
// 如果存在，那么就比较两者的 last_operation_time
// 如果相同，说明没有变化，然后
// 创建 FileTask append_line 2025-10-13 0 <b>
// 如果不同，说明对记录进行了更新
// 创建 FileTask append_line 2025-10-13 1 <a_update>
// 得到如下 FileTask
// 0. update_file 2025-10-13 <b a>
// 1. append_line 2025-10-13 <d>
// 2. append_line 2025-10-13 <c>
// 3. update_line 2025-10-13 1 <a_update>
// 4. update_file paste_event/meta <2025-10-13 12:00 2025-10-12 2025-10-12 21:51 2025-10-13 2025-10-13 12:00>
// 5. update_line paste_event/meta 0 2025-10-13 12:10
// 6. update_line paste_event/meta 2 2025-10-13 2025-10-13 12:10
// 创建 file operation
// 1. update_file 2025-10-13 <d c b a_update>
// 2. update_file paste_event/meta <2025-10-13 12:00 2025-10-12 2025-10-12 21:51 2025-10-13 2025-10-13 12:10>

func TestBuildFileOperationFromTasks(t *testing.T) {
	tests := []struct {
		name     string
		tasks    []*synchronizer.FileTask
		expected []*synchronizer.FileOperation
	}{
		{
			name: "new_file",
			tasks: []*synchronizer.FileTask{
				{
					Type:     "new_file",
					Filepath: "/devboard/paste_event/2025-10-12",
				},
				{
					Type:     "append_line",
					Filepath: "/devboard/paste_event/2025-10-12",
					Content:  "1",
				},
				{
					Type:     "append_line",
					Filepath: "/devboard/paste_event/2025-10-12",
					Content:  "2",
				},
			},
			expected: []*synchronizer.FileOperation{
				{
					Type:     "new_file",
					Filepath: "/devboard/paste_event/2025-10-12",
					Content:  "1\n2",
				},
			},
		},
		// {
		// 	name: "delete_line",
		// 	tasks: []*synchronizer.FileTask{
		// 		{
		// 			Type:     "new_file",
		// 			Filepath: "/path/to/file.txt",
		// 		},
		// 		{
		// 			Type:     "append_line",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "line1",
		// 		},
		// 		{
		// 			Type:     "append_line",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "line2",
		// 		},
		// 		{
		// 			Type:     "append_line",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "line3",
		// 		},
		// 		{
		// 			Type:     "delete_line",
		// 			Filepath: "/path/to/file.txt",
		// 			Line:     1,
		// 		},
		// 	},
		// 	expected: []*synchronizer.FileOperation{
		// 		{
		// 			Type:     "update_file",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "line1\nline3",
		// 		},
		// 	},
		// },
		{
			name: "update_line",
			tasks: []*synchronizer.FileTask{
				{
					Type:     "update_file",
					Filepath: "/devboard/paste_event/2025-10-12",
					Content:  "line1\nline2\nline3",
				},
				{
					Type:     "update_line",
					Filepath: "/devboard/paste_event/2025-10-12",
					Line:     1,
					Content:  "updated line2",
				},
				{
					Type:     "append_line",
					Filepath: "/devboard/paste_event/2025-10-12",
					Content:  "line4",
				},
			},
			expected: []*synchronizer.FileOperation{
				{
					Type:     "update_file",
					Filepath: "/devboard/paste_event/2025-10-12",
					Content:  "line1\nupdated line2\nline3\nline4",
				},
			},
		},
		{
			name: "update_line",
			tasks: []*synchronizer.FileTask{
				{
					Type:     "update_file",
					Filepath: "/devboard/paste_event/2025-10-12",
					Content:  "line1\nline2\nline3",
				},
			},
			expected: []*synchronizer.FileOperation{},
		},
		// {
		// 	name: "multiple_operations",
		// 	tasks: []*synchronizer.FileTask{
		// 		{
		// 			Type:     "new_file",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "line1\nline2\nline3",
		// 		},
		// 		{
		// 			Type:     "delete_line",
		// 			Filepath: "/path/to/file.txt",
		// 			Line:     1,
		// 		},
		// 		{
		// 			Type:     "append_line",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "line4",
		// 		},
		// 		{
		// 			Type:     "update_line",
		// 			Filepath: "/path/to/file.txt",
		// 			Line:     2,
		// 			Content:  "updated line3",
		// 		},
		// 	},
		// 	expected: []*synchronizer.FileOperation{
		// 		{
		// 			Type:     "update_file",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "line2\nupdated line3\nline4",
		// 		},
		// 	},
		// },
		// {
		// 	name: "delete_file",
		// 	tasks: []*synchronizer.FileTask{
		// 		{
		// 			Type:     "new_file",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "some content",
		// 		},
		// 		{
		// 			Type:     "delete_file",
		// 			Filepath: "/path/to/file.txt",
		// 		},
		// 	},
		// 	expected: []*synchronizer.FileOperation{
		// 		{
		// 			Type:     "delete_file",
		// 			Filepath: "/path/to/file.txt",
		// 			Content:  "",
		// 		},
		// 	},
		// },
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := synchronizer.BuildFileOperationsFromFileTasks(tt.tasks)

			// 首先检查结果数量是否匹配
			if len(result) != len(tt.expected) {
				t.Errorf("结果数量不匹配: 得到 %d 个操作, 期望 %d 个操作", len(result), len(tt.expected))
				return
			}

			// 然后逐个比较每个操作
			for i := 0; i < len(tt.expected); i++ {
				resOp := result[i]
				expOp := tt.expected[i]

				if resOp.Type != expOp.Type {
					t.Errorf("操作 #%d 类型不匹配:\n得到: %s\n期望: %s", i+1, resOp.Type, expOp.Type)
				}

				if resOp.Filepath != expOp.Filepath {
					t.Errorf("操作 #%d 文件路径不匹配:\n得到: %s\n期望: %s", i+1, resOp.Filepath, expOp.Filepath)
				}

				if resOp.Content != expOp.Content {
					t.Errorf("操作 #%d 内容不匹配:\n得到: %q\n期望: %q", i+1, resOp.Content, expOp.Content)
				}
			}
		})
	}
}
