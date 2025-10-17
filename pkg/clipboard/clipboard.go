package clipboard

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
)

var (
	err_unavailable = errors.New("clipboard unavailable")
	err_unsupported = errors.New("unsupported format")
)

// Format represents the format of clipboard data.
type Format int

// All sorts of supported clipboard data
const (
	// FmtText indicates plain text clipboard format
	FmtText Format = iota
	// FmtImage indicates image/png clipboard format
	FmtImage
	FmtFilepath
)

type ClipboardContent struct {
	Type  string // text纯文本 file文件 png图片 html富文本
	Data  interface{}
	Error error
}

var (
	// Due to the limitation on operating systems (such as darwin),
	// concurrent read can even cause panic, use a global lock to
	// guarantee one read at a time.
	lock      = sync.Mutex{}
	initOnce  sync.Once
	initError error
)

// Init initializes the clipboard package. It returns an error
// if the clipboard is not available to use. This may happen if the
// target system lacks required dependency, such as libx11-dev in X11
// environment. For example,
//
//	err := clipboard.Init()
//	if err != nil {
//		panic(err)
//	}
//
// If Init returns an error, any subsequent Read/Write/Watch call
// may result in an unrecoverable panic.
func Init() error {
	initOnce.Do(func() {
		initError = initialize()
	})
	return initError
}

// Read returns a chunk of bytes of the clipboard data if it presents
// in the desired format t presents. Otherwise, it returns nil.
func Read(t Format) ([]byte, error) {
	lock.Lock()
	defer lock.Unlock()
	buf, err := read(t)
	if err != nil {
		return nil, err
	}
	return buf, nil
}
func ReadText() (string, error) {
	lock.Lock()
	defer lock.Unlock()
	t, err := read_text()
	if err != nil {
		return "", nil
	}
	return t, nil
}
func ReadHTML() (string, error) {
	lock.Lock()
	defer lock.Unlock()
	t, err := read_html()
	if err != nil {
		return "", nil
	}
	return t, nil
}
func ReadImage() ([]byte, error) {
	lock.Lock()
	defer lock.Unlock()
	return read_image()
}
func ReadFiles() ([]string, error) {
	lock.Lock()
	defer lock.Unlock()
	return read_files()
}

// Write writes a given buffer to the clipboard in a specified format.
// Write returned a receive-only channel can receive an empty struct
// as a signal, which indicates the clipboard has been overwritten from
// this write.
// If format t indicates an image, then the given buf assumes
// the image data is PNG encoded.
func Write(t Format, buf []byte) (<-chan struct{}, error) {
	lock.Lock()
	defer lock.Unlock()
	changed, err := write(t, buf)
	if err != nil {
		return nil, err
	}
	return changed, nil
}

func WriteText(text string) error {
	lock.Lock()
	defer lock.Unlock()
	return write_text(text)
}
func WriteHTML(text string) error {
	lock.Lock()
	defer lock.Unlock()
	return write_html(text)
}
func WriteImage(data []byte) error {
	lock.Lock()
	defer lock.Unlock()
	return write_image(data)
}
func WriteFiles(files []string) error {
	lock.Lock()
	defer lock.Unlock()
	return write_files(files)
}

// Watch returns a receive-only channel that received the clipboard data
// whenever any change of clipboard data in the desired format happens.
//
// The returned channel will be closed if the given context is canceled.
func Watch(ctx context.Context) <-chan ClipboardContent {
	return watch(ctx)
}

type ContentTypeParams struct {
	IsEnabled bool // 粘贴板已经处于可用状态
}

func GetContentTypes(params ContentTypeParams) []string {
	return get_content_types(params)
}

func ByteToStrArray(b []byte) ([]string, error) {
	var strs []string
	err := json.Unmarshal(b, &strs)
	return strs, err
}

func StrArrayToByte(strs []string) []byte {
	var total_len int
	for _, str := range strs {
		total_len += len(str)
	}
	result := make([]byte, total_len)
	offset := 0
	for _, str := range strs {
		str_bytes := []byte(str)
		copy(result[offset:], str_bytes)
		offset += len(str_bytes)
	}
	return result
}
