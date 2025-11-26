package autostart

// AutoStart provides cross-platform autostart functionality
type AutoStart interface {
	Enable() error
	Disable() error
	IsEnabled() bool
}

// New creates a new AutoStart instance for the current platform
func New(appName string) AutoStart {
	return newPlatformAutoStart(appName)
}
