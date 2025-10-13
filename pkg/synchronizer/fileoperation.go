package synchronizer

import "strings"

func BuildFileOperationsFromFileTasks(tasks []*FileTask) []*FileOperation {
	// 按文件路径分组
	files_group_by_path := make(map[string][]*FileTask)
	for _, task := range tasks {
		files_group_by_path[task.Filepath] = append(files_group_by_path[task.Filepath], task)
	}
	var result []*FileOperation
	// 先聚合对一个文件的所有操作
	for file_path, tasks := range files_group_by_path {
		if len(tasks) == 0 {
			continue
		}
		first_task := tasks[0]
		if first_task.Type == "new_file" {
			if len(tasks) == 1 {
				continue
			}
			result_lines := []string{}
			// 处理所有针对该文件的操作
			for _, op := range tasks[1:] {
				switch op.Type {
				case "append_line":
					result_lines = append(result_lines, op.Content)
				case "update_line":
				case "delete_line":
				}
			}
			result = append(result, &FileOperation{
				Type:     "new_file",
				Filepath: file_path,
				Content:  strings.Join(result_lines, "\n"),
			})
		}
		if first_task.Type == "update_file" {
			if len(tasks) == 1 {
				continue
			}
			result_lines := SplitToLines([]byte(first_task.Content))
			for _, op := range tasks[1:] {
				switch op.Type {
				case "update_line":
					result_lines[op.Line] = op.Content
				}
			}
			for _, op := range tasks[1:] {
				switch op.Type {
				case "append_line":
					result_lines = append(result_lines, op.Content)
				}
			}
			result = append(result, &FileOperation{
				Type:     "update_file",
				Filepath: file_path,
				Content:  strings.Join(result_lines, "\n"),
			})
		}
	}

	return result
}
