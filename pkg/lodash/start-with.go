package lodash

import (
	"strings"
)

func StartWith(str string, prefix string) bool {
	if strings.HasPrefix(str, prefix) {
		return true
	}
	return false
}
