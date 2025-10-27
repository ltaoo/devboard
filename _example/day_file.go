package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func main() {
	// data, err := os.ReadFile("./_example/2025-10-24")
	// if err != nil {
	// 	fmt.Println(err.Error())
	// 	return
	// }
	// scanner := bufio.NewScanner(bytes.NewReader(data))
	// var lines []string
	// for scanner.Scan() {
	// 	lines = append(lines, scanner.Text())
	// }
	// fmt.Println(len(lines))

	data, err := os.ReadFile("./_example/2025-10-24")
	if err != nil {
		fmt.Println(err.Error())
		return
	}

	var lines []string
	var lineStart int

	for i := 0; i < len(data); i++ {
		// 检查换行符
		if data[i] == '\n' {
			// 找到一行
			line := data[lineStart:i]
			// 如果是 \r\n，去掉 \r
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			lines = append(lines, string(line))
			lineStart = i + 1
		} else if data[i] == '\r' {
			// 处理单独的 \r 或 \r\n
			line := data[lineStart:i]
			lines = append(lines, string(line))

			// 跳过可能的 \n
			if i+1 < len(data) && data[i+1] == '\n' {
				i++
			}
			lineStart = i + 1
		}
	}

	// 处理最后一行（如果没有换行符结尾）
	if lineStart < len(data) {
		lines = append(lines, string(data[lineStart:]))
	}

	fmt.Println("行数:", len(lines))
	record := lines[0]

	var d map[string]interface{}
	if err := json.Unmarshal([]byte(record), &d); err != nil {
		fmt.Println(err.Error())
		return
	}
	fmt.Println(d["sync_status"], d["sync_status"] == '1', d["sync_status"] == '2')
	if d["sync_status"] == float64(1) {
		fmt.Println("is 1")
	}
	if d["sync_status"] == float64(2) {
		fmt.Println("is 2")
	}
}
