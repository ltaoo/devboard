package util

import (
	"strconv"
	"time"
)

func GetNowSecond() string {
	return strconv.FormatInt(time.Now().Unix(), 10)
}

func GetNowSecondWithMilli() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}
