package main

import (
	"fmt"

	"devboard/pkg/system"
)

func main() {
	name, err := system.GetForegroundProcess()
	if err != nil {
		fmt.Println("[error]", err.Error())
		return
	}
	fmt.Println(name)
}
