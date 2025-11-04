package system

type ForegroundProcess struct {
	Name            string
	ExecuteFullPath string
	WindowTitle     string
	Reference       interface{} // 应用的引用，后续可以通过该引用 focus
}

func GetForegroundProcess() (*ForegroundProcess, error) {
	return get_foreground_process()
}

func ActiveProcess(id interface{}) error {
	return active_process(id)
}
