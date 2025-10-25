package main

import (
	"devboard/pkg/system"
	"fmt"
)

func main() {
	window_title, err := system.GetWindowTitle()
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(window_title)
}
