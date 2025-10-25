package main

import (
	"devboard/pkg/system"
	"fmt"
)

func main() {
	name, err := system.GetComputerName()
	if err != nil {
		fmt.Println("[ERROR]", err.Error())
		return
	}
	fmt.Println(name)
}
