package html

import (
	"regexp"
	"strings"
)

func CleanStyle(style string, remainingKeys []string) string {
	if style == "" || len(remainingKeys) == 0 {
		return ""
	}

	// 创建保留键的映射，便于快速查找
	allowedKeys := make(map[string]bool)
	for _, key := range remainingKeys {
		allowedKeys[strings.ToLower(strings.TrimSpace(key))] = true
	}

	// 分割样式声明
	declarations := strings.Split(style, "; ")
	var cleanedDeclarations []string

	for _, decl := range declarations {
		decl = strings.TrimSpace(decl)
		if decl == "" {
			continue
		}

		// 分割键值对
		parts := strings.SplitN(decl, ":", 2)
		if len(parts) != 2 {
			continue // 无效的声明格式，跳过
		}

		key := strings.ToLower(strings.TrimSpace(parts[0]))
		value := strings.TrimSpace(parts[1])
		if value == "revert" {
			continue
		}
		if value == "initial" {
			continue
		}
		if value == "inherit" {
			continue
		}
		// fmt.Println("check need remaining", key, value)
		// 检查是否在保留列表中
		if allowedKeys[key] {
			cleanedDeclarations = append(cleanedDeclarations, key+":"+value)
		}
	}

	return strings.Join(cleanedDeclarations, "; ")
}

// 或者如果你希望remainingKeys是固定的，可以这样实现：
func CleanStyleFixed(style string) string {
	// 定义需要保留的样式属性
	remainingKeys := []string{
		"position",
		"overflow",
		"z-index",
		"outline",
		"margin",
		"margin-left",
		"margin-right",
		"margin-top",
		"margin-bottom",
		"border",
		"border-color",
		"border-width",
		"border-radius",
		"padding",
		"padding-left",
		"padding-right",
		"padding-top",
		"padding-bottom",
		"width",
		"min-width",
		"max-width",
		"height",
		"min-height",
		"max-height",
		"content",
		"display",
		"flex",
		"flex-flow",
		"gap",
		"float",
		"clear",
		"cursor",
		"box-sizing",
		"box-shadow",
		"color",
		"line-height",
		"direction",
		"font-size",
		"font-weight",
		"font-family",
		"text-align",
		"text-decoration",
		"text-overflow",
		"text-shadow",
		"line-height",
		"opacity",
		"background",
		"background-color",
		"background-size",
		"background-image",
		"background-position",
		"background-origin",
		"background-repeat",
		"list-style",
		"shadow",
		"visibility",
		"translate",
		"transform",
		"transform-origin",
		"transform-style",
		"rotate",
		"zoom",
	}

	return CleanStyle(style, remainingKeys)
}

// 更严格的清理版本，只保留最常用的样式
func CleanRichTextStrict(html string) string {
	// 只保留最核心的样式属性
	style_names := []string{
		"position",
		"overflow",
		"z-index",
		"outline",
		"margin",
		"margin-left",
		"margin-right",
		"margin-top",
		"margin-bottom",
		"border",
		"border-color",
		"border-width",
		"border-radius",
		"padding",
		"padding-inline",
		"padding-left",
		"padding-right",
		"padding-top",
		"padding-bottom",
		"width",
		"min-width",
		"max-width",
		"height",
		"min-height",
		"max-height",
		"content",
		"display",
		"flex",
		"flex-flow",
		"gap",
		"grid-auto-columns",
		"grid-auto-flow",
		"grid-auto-rows",
		"grid-template-areas",
		"grid-template-columns",
		"grid-template-rows",
		"float",
		"clear",
		"cursor",
		"box-sizing",
		"box-shadow",
		"color",
		"line-height",
		"direction",
		"font-size",
		"font-weight",
		"font-family",
		"text-align",
		"text-decoration",
		"text-overflow",
		"text-shadow",
		"white-space",
		"line-height",
		"opacity",
		"background",
		"background-color",
		"background-size",
		"background-image",
		"background-position",
		"background-origin",
		"background-repeat",
		"list-style",
		"shadow",
		"visibility",
		"translate",
		"transform",
		"transform-origin",
		"transform-style",
		"rotate",
		"scale",
	}

	styleRegex := regexp.MustCompile(`style {0,1}= {0,1}["'][^"']{1,}["']`)

	cleanedHTML := styleRegex.ReplaceAllStringFunc(html, func(match string) string {
		valueRegex := regexp.MustCompile(`["']([^"']{1,})["']`)
		matches := valueRegex.FindStringSubmatch(match)
		if len(matches) < 2 {
			return `style=""`
		}

		styleValue := matches[1]
		// fmt.Println("before clean", styleValue)
		cleanedStyle := CleanStyle(styleValue, style_names)
		// fmt.Println("after CleanStyle", cleanedStyle)
		if cleanedStyle == "" {
			return ""
		}

		return `style="` + cleanedStyle + `;"`
	})
	// fmt.Println("cleaned html", cleanedHTML)
	return cleanedHTML
}
