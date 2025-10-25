package system

type ForegroundProcess struct {
	Name            string
	ExecuteFullPath string
	WindowTitle     string
}

func GetForegroundProcess() (*ForegroundProcess, error) {
	return get_foreground_process()
}
