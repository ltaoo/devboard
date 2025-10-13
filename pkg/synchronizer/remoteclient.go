package synchronizer

import (
	"os"
	"strings"
	"time"

	"github.com/studio-b12/gowebdav"

	"devboard/pkg/fsmock"
)

type RemoteClient interface {
	Stat(file_path string) (os.FileInfo, error)
	Read(file_path string) ([]byte, error)
	ReadDir(file_path string) ([]os.FileInfo, error)
	IsErrNotFound(err error) bool
	WithDirectoryStructure(structure map[string]interface{})
	BuildStructure(base_path string, structure map[string]interface{})
	SetFS(fs *fsmock.FS)
}

type WebdavClient struct {
	Client *gowebdav.Client
}

func (c *WebdavClient) Stat(file_path string) (os.FileInfo, error) {
	return c.Client.Stat(file_path)
}
func (c *WebdavClient) Read(file_path string) ([]byte, error) {
	return c.Client.Read(file_path)
}
func (c *WebdavClient) ReadDir(dir_path string) ([]os.FileInfo, error) {
	return c.Client.ReadDir(dir_path)
}
func (c *WebdavClient) IsErrNotFound(err error) bool {
	return gowebdav.IsErrNotFound(err)
}
func (c *WebdavClient) WithDirectoryStructure(structure map[string]interface{}) {
}
func (c *WebdavClient) BuildStructure(base string, structure map[string]interface{}) {
}
func (c *WebdavClient) SetFS(fs *fsmock.FS) {
}

func NewWebdavClient(client *gowebdav.Client) RemoteClient {
	return &WebdavClient{
		Client: client,
	}
}

type MockFileInfo struct {
	name    string
	size    int64
	mode    os.FileMode
	modTime time.Time
	isDir   bool
	content string
	// files   map[string]MockFileInfo
}

func (m MockFileInfo) Name() string       { return m.name }
func (m MockFileInfo) Size() int64        { return m.size }
func (m MockFileInfo) Mode() os.FileMode  { return m.mode }
func (m MockFileInfo) ModTime() time.Time { return m.modTime }
func (m MockFileInfo) IsDir() bool        { return m.isDir }
func (m MockFileInfo) Sys() interface{}   { return nil }

type MockRemoteClient struct {
	fs *fsmock.FS
	// root_dir MockFileInfo
	// files    map[string]MockFileInfo
}

func (c *MockRemoteClient) Stat(path string) (os.FileInfo, error) {
	path = strings.TrimLeft(path, "/")
	// path = filepath.Clean(path)
	// parts := strings.Split(path, string(filepath.Separator))
	// current := c.root_dir
	// for _, part := range parts {
	// 	if part == "" {
	// 		continue
	// 	}
	// 	if !current.isDir {
	// 		return nil, os.ErrNotExist
	// 	}
	// 	next, ok := c.files[part]
	// 	if !ok {
	// 		return nil, os.ErrNotExist
	// 	}
	// 	current = next
	// }
	// return current, nil
	return c.fs.Stat(path)
}
func (c *MockRemoteClient) Read(path string) ([]byte, error) {
	path = strings.TrimLeft(path, "/")
	// path = filepath.Clean(path)
	// parts := strings.Split(path, string(filepath.Separator))
	// current := c.root_dir
	// for _, part := range parts {
	// 	if part == "" {
	// 		continue // 跳过空部分（如路径开头的/）
	// 	}
	// 	if !current.isDir {
	// 		return nil, os.ErrNotExist
	// 	}
	// 	next, ok := c.files[part]
	// 	if !ok {
	// 		return nil, os.ErrNotExist
	// 	}
	// 	current = next
	// }
	// return []byte(current.content), nil
	return c.fs.ReadFile(path)
}
func (c *MockRemoteClient) ReadDir(path string) ([]os.FileInfo, error) {
	path = strings.TrimLeft(path, "/")
	// path = filepath.Clean(path)
	// parts := strings.Split(path, string(filepath.Separator))
	// current := c.root_dir
	// for _, part := range parts {
	// 	if part == "" {
	// 		continue // 跳过空部分（如路径开头的/）
	// 	}
	// 	if !current.isDir {
	// 		return nil, os.ErrNotExist
	// 	}
	// 	next, ok := c.files[part]
	// 	if !ok {
	// 		return nil, os.ErrNotExist
	// 	}
	// 	current = next
	// }
	// var files []os.FileInfo
	// for _, f := range c.files {
	// 	files = append(files, f)
	// }
	// return files, nil
	dirs, err := c.fs.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var files []os.FileInfo
	for _, dir := range dirs {
		files = append(files, MockFileInfo{
			name:  dir.Name(),
			isDir: dir.IsDir(),
		})
	}
	return files, nil
}
func (m *MockRemoteClient) IsErrNotFound(err error) bool {
	return os.IsNotExist(err)
}

func (m *MockRemoteClient) WithDirectoryStructure(structure map[string]interface{}) {
}
func (m *MockRemoteClient) BuildStructure(base_path string, structure map[string]interface{}) {
}
func (m *MockRemoteClient) SetFS(fs *fsmock.FS) {
	m.fs = fs
}

func NewMockRemoteClient() RemoteClient {
	return &MockRemoteClient{}
}
