package fsmock

import (
	"bytes"
	"io"
	"io/fs"
	"path"
	"strings"
	"time"
)

type openEntry interface {
	fs.File
	fs.DirEntry
}

// Entry is an internal interface defining entries in a filesystem's directory.
// Dir and File both satisfy this internal interface and can be used in client
// code.
type Entry interface {
	name() string
	open() openEntry
	touch()
}

// Dir implements a directory in the filesystem.
type Dir struct {
	// Name defines the directory's name.
	Name string
	// ModTime defines the directory's modification time.
	ModTime time.Time
	// Children contains the directory's direct children.
	Children []Entry
}

// NewDir creates a new directory.
func NewDir(name string, children ...Entry) *Dir {
	return &Dir{
		Name:     name,
		ModTime:  time.Now(),
		Children: children,
	}
}

func (d *Dir) name() string { return d.Name }

func (d *Dir) open() openEntry {
	return &openDir{
		d:       d,
		entries: d.Children[:],
	}
}

func (d *Dir) touch() {
	d.ModTime = time.Now()
}

func (d *Dir) find(op, name string) (Entry, error) {
	if name == "." || name == "" {
		return d, nil
	}

	e, err := d.findPath(strings.Split(name, "/"))
	if err != nil {
		return e, &fs.PathError{
			Op:   op,
			Path: name,
			Err:  err,
		}
	}

	return e, nil
}

func (d *Dir) findPath(pathElements []string) (Entry, error) {
	c, _ := d.findChild(pathElements[0])
	if c == nil {
		return nil, fs.ErrNotExist
	}

	if len(pathElements) == 1 {
		return c, nil
	}

	if sub, ok := c.(*Dir); ok {
		return sub.findPath(pathElements[1:])
	}

	return nil, fs.ErrInvalid
}

func (d *Dir) findChild(name string) (Entry, int) {
	for i, e := range d.Children {
		if e.name() == name {
			return e, i
		}
	}
	return nil, 0
}

type openDir struct {
	d       *Dir
	entries []Entry
}

var _ fs.ReadDirFile = &openDir{}
var _ fs.DirEntry = &openDir{}

// Close is a no-op for directories.
func (d *openDir) Close() error { return nil }

// Stat retrieves the directory's stats.
func (d *openDir) Stat() (fs.FileInfo, error) { return d, nil }

// Name returns the base name of the directory.
func (d *openDir) Name() string { return d.d.Name }

// Size always returns 0 for directories.
func (d *openDir) Size() int64 { return 0 }

// Mode returns the directory's file.
func (d *openDir) Mode() fs.FileMode { return fs.ModeDir }

// ModTime returns the directory's modification time.
func (d *openDir) ModTime() time.Time { return d.d.ModTime }

// IsDir returns true for a directory.
func (d *openDir) IsDir() bool { return true }

// Sys alsways returns nil.
func (d *openDir) Sys() interface{} { return nil }

// Info returns the directory's file info.
func (d *openDir) Info() (fs.FileInfo, error) { return d, nil }

// Type returns the directory's type which is fs.ModeDir.
func (d *openDir) Type() fs.FileMode { return fs.ModeDir | fs.ModeType }

// ReadDir reads the contents of the directory and returns
// a slice of up to n DirEntry values in directory order.
// Subsequent calls on the same file will yield further DirEntry values.
//
// If n > 0, ReadDir returns at most n DirEntry structures.
// In this case, if ReadDir returns an empty slice, it will return
// a non-nil error explaining why.
// At the end of a directory, the error is io.EOF.
// (ReadDir must return io.EOF itself, not an error wrapping io.EOF.)
//
// If n <= 0, ReadDir returns all the DirEntry values from the directory
// in a single slice. In this case, if ReadDir succeeds (reads all the way
// to the end of the directory), it returns the slice and a nil error.
// If it encounters an error before the end of the directory,
// ReadDir returns the DirEntry list read until that point and a non-nil error.
func (d *openDir) ReadDir(n int) ([]fs.DirEntry, error) {
	var e []Entry

	if n <= 0 {
		e = d.entries
	} else {
		n = min(len(d.entries)-1, n)
		e = d.entries[:n]
		d.entries = d.entries[n:]
	}

	r := make([]fs.DirEntry, len(e))

	for i := range e {
		r[i] = e[i].open()
	}

	return r, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Read always returns zero bytes for a directory.
func (d *openDir) Read([]byte) (int, error) {
	return 0, io.EOF
}

// --

// File is a file in the fileysystem.
type File struct {
	// Name defines the file's base name.
	Name string
	// Mode defines the file's mode.
	Mode fs.FileMode
	// ModTime defines the file's modification time.
	ModTime time.Time
	// Content is the file's content.
	Content []byte
}

// EmptyFile creates an empty file.
func EmptyFile(name string) *File {
	return NewFile(name, nil)
}

// TextFile creates a new file with string content.
func TextFile(name, content string) *File {
	return NewFile(name, []byte(content))
}

// NewFile creates a new file.
func NewFile(name string, content []byte) *File {
	return &File{
		Name:    name,
		Mode:    0,
		ModTime: time.Now(),
		Content: content,
	}
}

func (f *File) name() string { return f.Name }

func (f *File) open() openEntry {
	return &openFile{
		f:      f,
		Reader: bytes.NewReader(f.Content),
	}
}

func (f *File) touch() {
	f.ModTime = time.Now()
}

type openFile struct {
	f *File
	io.Reader
}

var _ fs.File = &openFile{}
var _ fs.DirEntry = &openFile{}

// Close closes f which is a no-op.
func (f *openFile) Close() error { return nil }

// Stat retrieves the fs.FileInfo of f.
func (f *openFile) Stat() (fs.FileInfo, error) { return f, nil }

// Name returns the base name of f.
func (f *openFile) Name() string { return f.f.Name }

// Size returns the length in bytes of f.
func (f *openFile) Size() int64 { return int64(len(f.f.Content)) }

// Mode returns f mode.
func (f *openFile) Mode() fs.FileMode { return f.f.Mode }

// ModTime returns the last modification timestamp of f.
func (f *openFile) ModTime() time.Time { return f.f.ModTime }

// IsDir returns whether f is a directory (which it is not).
func (f *openFile) IsDir() bool { return false }

// Sys always returns nil.
func (f *openFile) Sys() interface{} { return nil }

// Info retrieves a fs.FileInfo about f.
func (f *openFile) Info() (fs.FileInfo, error) { return f, nil }

// Type returns f type.
func (f *openFile) Type() fs.FileMode { return 0 | fs.ModeType }

// FS implements a mocked fs.FS. It also implements several other interfaces
// from the fs package, namely
// - fs.ReadDirFS
// - fs.ReadFileFS
// - fs.StatFS
// - fs.SubFS
//
// In addition FS provides some useful methods to create files, directories
// and modify existing ones which reflect some of the basic POSIX shell
// commands, such as mkdir, rm, touch, ...
type FS struct {
	root *Dir
}

// New creates a new FS using root as the root directory.
func New(root *Dir) *FS {
	return &FS{root}
}

// Touch works like the POSIX shell command touch. It either updates the
// modified timestamp of the file or directory named name or creates an
// empty file with that name if name's parent exists and is a directory.
func (f *FS) Touch(name string) error {
	dir, file := path.Split(name)
	dir = strings.TrimRight(dir, "/")
	d, err := f.findDir("open", dir)
	if err != nil {
		return err
	}

	c, _ := d.findChild(file)
	if c == nil {
		d.Children = append(d.Children, EmptyFile(file))
		return nil
	}

	c.touch()
	return nil
}

// Mkdir works like the POSIX shell command mkdir and creates the directory
// name. All parent directories must exist for this call to succeed (it does
// not work like mkdir -p on some systems).
func (f *FS) Mkdir(name string) error {
	parent, toCreate := path.Split(name)
	parent = strings.TrimRight(parent, "/")
	d, err := f.findDir("open", parent)
	if err != nil {
		return err
	}

	if c, _ := d.findChild(toCreate); c != nil {
		return &fs.PathError{
			Op:   "mkdir",
			Path: name,
			Err:  fs.ErrExist,
		}
	}

	d.Children = append(d.Children, NewDir(toCreate))
	return nil
}

// Rm removes an element from the filesystem in a similar way to the unix shell
// command "rm -rf". name is the full path of the element to remove. If the
// element is a directory it is recursively.
func (f *FS) Rm(name string) {
	parent, elem := path.Split(name)
	parent = strings.TrimRight(parent, "/")

	d, err := f.findDir("open", parent)
	if err != nil {
		// The parent directory does not exist. So it's impossible for name
		// to exist. Looks like we're done here...
		return
	}

	c, idx := d.findChild(elem)

	if c == nil {
		// Child is not found. Everything done...
		return
	}

	if idx != len(d.Children)-1 {
		d.Children[idx] = d.Children[len(d.Children)-1]
	}

	d.Children = d.Children[:len(d.Children)-1]
}

// Open opens the named file.
//
// When Open returns an error, it should be of type *PathError
// with the Op field set to "open", the Path field set to name,
// and the Err field describing the problem.
//
// Open should reject attempts to open names that do not satisfy
// ValidPath(name), returning a *PathError with Err set to
// ErrInvalid or ErrNotExist.
func (f *FS) Open(name string) (fs.File, error) {
	e, err := f.root.find("open", name)
	if err != nil {
		return nil, err
	}

	return e.open(), nil
}

// ReadDir reads the named directory
// and returns a list of directory entries sorted by filename.
func (f *FS) ReadDir(name string) ([]fs.DirEntry, error) {
	d, err := f.findDir("readDir", name)
	if err != nil {
		return nil, err
	}

	return d.open().(*openDir).ReadDir(-1)
}

// ReadFile reads the named file and returns its contents.
// A successful call returns a nil error, not io.EOF.
// (Because ReadFile reads the whole file, the expected EOF
// from the final Read is not treated as an error to be reported.)
//
// The caller is permitted to modify the returned byte slice.
// This method should return a copy of the underlying data.
func (f *FS) ReadFile(name string) ([]byte, error) {
	fi, err := f.Open(name)
	if err != nil {
		return nil, err
	}
	defer fi.Close()

	return io.ReadAll(fi)
}

// Stat returns a FileInfo describing the file.
// If there is an error, it should be of type *PathError.
func (f *FS) Stat(name string) (fs.FileInfo, error) {
	fi, err := f.root.find("stat", name)
	if err != nil {
		return nil, err
	}

	return fi.open().Stat()
}

// Sub returns an FS corresponding to the subtree rooted at dir.
func (f *FS) Sub(name string) (fs.FS, error) {
	d, err := f.findDir("sub", name)
	if err != nil {
		return nil, err
	}

	return New(d), nil
}

// // Glob returns the names of all files matching pattern,
// // providing an implementation of the top-level
// // Glob function.
// func (f fsys) Glob(pattern string) ([]string, error) {
// }

var (
	_ fs.FS         = &FS{}
	_ fs.ReadDirFS  = &FS{}
	_ fs.ReadFileFS = &FS{}
	_ fs.StatFS     = &FS{}
	_ fs.SubFS      = &FS{}
)

func (f *FS) findDir(op, name string) (*Dir, error) {
	e, err := f.root.find(op, name)
	if err != nil {
		return nil, err
	}

	d, ok := e.(*Dir)
	if !ok {
		return nil, &fs.PathError{
			Op:   "ReadDir",
			Path: name,
			Err:  fs.ErrInvalid,
		}
	}

	return d, nil

}
