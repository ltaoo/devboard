package transformer

import (
	"regexp"
)

func isGolang(code string) bool {
	if match, _ := regexp.MatchString(`:=`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`type [a-zA-Z]{1,} struct {0,1}\{`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`fmt\.`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`func [a-zA-Z]{1,} {0,}\(`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`func\(`, code); match {
		return true
	}
	return false
}

func isPython(code string) bool {
	if match, _ := regexp.MatchString(`'''[\s\S]*?'''|"""[\s\S]*?"""`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`def\s+\w+\s*\(.*?\)\s*:`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`elif\s+`, code); match {
		return true
	}
	return false
}

func isRust(code string) bool {
	if match, _ := regexp.MatchString(`fn\s+\w+\s*\(.*?\)\s*:`, code); match {
		return true
	}
	return false
}

func isTypeScript(code string) bool {
	if match, _ := regexp.MatchString(`type [a-zA-Z0-9]{1,} {0,1}= {0,1}\{`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`interface [a-zA-Z0-9]{1,} {0,1}\{`, code); match {
		return true
	}
	return false
}

func isJavaScript(code string) bool {
	if match, _ := regexp.MatchString(`=> {0,1}[a-zA-Z0-9{]{1,}`, code); match {
		return true
	}
	return false
}

func isReactJSX(code string) bool {
	if match, _ := regexp.MatchString(`from ['"]react['"]`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`className=`, code); match && regexp.MustCompile(`<[a-zA-Z]{1,}`).MatchString(code) {
		return true
	}
	if match, _ := regexp.MatchString(`style=\{\{`, code); match && regexp.MustCompile(`<[a-zA-Z]{1,}`).MatchString(code) {
		return true
	}
	if match, _ := regexp.MatchString(`useState|useCallback|useMemo|useEffect`, code); match {
		return true
	}
	return false
}

func isVueFile(code string) bool {
	if match, _ := regexp.MatchString(`from ['"]vue['"]`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`<script\s+setup>`, code); match {
		return true
	}
	return false
}
func isJSON(code string) bool {
	if match, _ := regexp.MatchString(`^{[\s\n]{0,}"[a-zA-Z0-9_-]{1,}":`, code); match {
		return true
	}
	return false
}
func isHTML(code string) bool {
	if match, _ := regexp.MatchString(`<!doctype\s+html>`, code); match {
		return true
	}
	if match, _ := regexp.MatchString(`<html[\s>]`, code); match {
		return true
	}
	return false
}

// DetectCodeLanguage 检测代码语言或框架类型
func DetectCodeLanguage(code string) string {
	if isJSON(code) {
		return "JSON"
	}
	if isGolang(code) {
		return "Go"
	}
	if isPython(code) {
		return "Python"
	}
	if isRust(code) {
		return "Rust"
	}
	if isTypeScript(code) {
		return "TypeScript"
	}
	if isJavaScript(code) {
		return "JavaScript"
	}
	if isHTML(code) {
		return "HTML"
	}
	if isReactJSX(code) {
		return "React"
	}
	if isVueFile(code) {
		return "Vue"
	}
	return ""
}

// TextContentDetector 检测文本内容类型
func TextContentDetector(text string) []string {
	if match, _ := regexp.MatchString(`^https{0,1}://`, text); match {
		return []string{"url"}
	}
	if match, _ := regexp.MatchString(`^#[a-f0-9]{3,6}`, text); match {
		return []string{"color"}
	}
	if match, _ := regexp.MatchString(`^17([0-9]{8}|[0-9]{11})`, text); match {
		return []string{"time"}
	}
	if match, _ := regexp.MatchString(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}[+-]\d{2}:\d{2}$`, text); match {
		return []string{"time"}
	}
	if lang := DetectCodeLanguage(text); lang != "" {
		return []string{lang, "code"}
	}
	return []string{
		"text",
	}
}
