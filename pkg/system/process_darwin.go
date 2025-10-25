//go:build darwin && !ios

package system

func get_foreground_process() (*ForegroundProcess, error) {
	return nil, nil
}
