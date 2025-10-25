package html

import (
	"regexp"
	"strings"
)

type ClipboardHTMLContent struct {
	SourceURL   string
	HTMLContent string
	RawContent  string
	PlainText   string
}

func parse_html_in_windows(data string) (source_url, html_content string) {
	lines := strings.Split(data, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "SourceURL:") {
			source_url = strings.TrimSpace(strings.TrimPrefix(line, "SourceURL:"))
			break
		}
	}
	html_content = data
	html_regexp := regexp.MustCompile(`(?s)<html>.*</html>`)
	html_match := html_regexp.FindString(data)
	if html_match != "" {
		html_content = html_match
	} else {
		// 如果找不到完整的html标签，提取片段内容
		frag_regex := regexp.MustCompile(`(?s)<!--StartFragment-->.*<!--EndFragment-->`)
		frag_match := frag_regex.FindString(data)
		if frag_match != "" {
			html_content = frag_match
		}
	}
	return source_url, html_content
}

func parse_html_in_darwin(data string) string {
	re := regexp.MustCompile(`^<meta[^>]{1,}>`)
	result := re.ReplaceAllString(data, "")
	return result
}

func ParseHTMLContent(data string) *ClipboardHTMLContent {
	result := &ClipboardHTMLContent{
		HTMLContent: data,
		RawContent:  data,
	}
	trimmed := strings.TrimSpace(data)
	if strings.HasPrefix(trimmed, "Version:") && strings.Contains(trimmed, "<html>") {
		result.SourceURL, result.HTMLContent = parse_html_in_windows(trimmed)
	} else if strings.HasPrefix(trimmed, "<meta ") {
		result.HTMLContent = parse_html_in_darwin(trimmed)
	}
	return result
}
