package util

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func SaveByteAsLocalImage(data []byte) (string, error) {
	// 解码图片数据
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("解码图片失败: %v\n", err)
	}

	// 生成文件名（使用当前时间戳）
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("clipboard_image_%s.png", timestamp)

	// 创建输出文件
	outputFile, err := os.Create(filename)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %v\n", err)
	}
	defer outputFile.Close()

	// 保存图片为PNG格式
	err = png.Encode(outputFile, img)
	if err != nil {
		return "", fmt.Errorf("保存图片失败: %v\n", err)
	}

	// 获取文件的绝对路径
	absPath, err := filepath.Abs(filename)
	if err != nil {
		absPath = filename
	}
	return absPath, nil

}

// AutoByteSize 自动选择最合适的字节显示格式
// 小数值(<10MB)使用SI单位(十进制)，大数值(≥10MB)使用IEC单位(二进制)
// 自动选择最合适的单位，保留2位小数但去除不必要的零
func AutoByteSize(b int64) string {
	const (
		siUnit    = 1000
		iecUnit   = 1024
		threshold = 10 * 1000 * 1000 // 10MB
	)

	// 小于1KB直接显示字节
	if b < siUnit {
		return fmt.Sprintf("%d B", b)
	}

	// 决定使用SI还是IEC单位
	unit := siUnit
	units := "kMGTPE"
	if b >= threshold {
		unit = iecUnit
		units = "KMGTPE"
	}

	// 计算最合适的单位
	exp := int(math.Log(float64(b)) / math.Log(float64(unit)))
	if exp > len(units) {
		exp = len(units)
	}
	if exp == 0 {
		exp = 1
	}

	// 计算值并格式化
	value := float64(b) / math.Pow(float64(unit), float64(exp))
	formatted := fmt.Sprintf("%.2f", value)
	formatted = strings.TrimRight(strings.TrimRight(formatted, "0"), ".")

	// 添加单位
	unitChar := units[exp-1]
	if unit == iecUnit {
		return fmt.Sprintf("%s %ciB", formatted, unitChar)
	}
	return fmt.Sprintf("%s %cB", formatted, unitChar)
}
