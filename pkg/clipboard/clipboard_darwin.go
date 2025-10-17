//go:build darwin && !ios

package clipboard

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unsafe"

	"github.com/ebitengine/purego"
	"github.com/ebitengine/purego/objc"
)

func must(sym uintptr, err error) uintptr {
	if err != nil {
		panic(err)
	}
	return sym
}

func must2(sym uintptr, err error) uintptr {
	if err != nil {
		panic(err)
	}
	// dlsym returns a pointer to the object so dereference like this to avoid possible misuse of 'unsafe.Pointer' warning
	return **(**uintptr)(unsafe.Pointer(&sym))
}

var (
	appkit = must(purego.Dlopen("/System/Library/Frameworks/AppKit.framework/AppKit", purego.RTLD_GLOBAL|purego.RTLD_NOW))

	_NSWorkspace          = objc.GetClass("NSWorkspace")
	_sharedWorkspace      = objc.RegisterName("sharedWorkspace")
	_frontmostApplication = objc.RegisterName("frontmostApplication")
	_localizedName        = objc.RegisterName("localizedName")

	_NSPasteboard             = objc.GetClass("NSPasteboard")
	_generalPasteboard        = objc.RegisterName("generalPasteboard")
	_clearContents            = objc.RegisterName("clearContents")
	_types                    = objc.RegisterName("types")
	_changeCount              = objc.RegisterName("changeCount")
	_dataForType              = objc.RegisterName("dataForType:")
	_setDataForType           = objc.RegisterName("setData:forType:")
	_propertyListForType      = objc.RegisterName("propertyListForType:")
	_writeObjects             = objc.RegisterName("writeObjects:")
	_setPropertyList_forType_ = objc.RegisterName("setPropertyListForType:")
	// https://developer.apple.com/documentation/appkit/nspasteboard/pasteboardtype?language=objc
	_NSPasteboardTypeString = must2(purego.Dlsym(appkit, "NSPasteboardTypeString"))
	_NSPasteboardTypeHTML   = must2(purego.Dlsym(appkit, "NSPasteboardTypeHTML"))
	_NSPasteboardTypePNG    = must2(purego.Dlsym(appkit, "NSPasteboardTypePNG"))
	_NSPasteboardTypeFiles  = must2(purego.Dlsym(appkit, "NSFilenamesPboardType"))

	_NSMutableArray         = objc.GetClass("NSMutableArray")
	_NSArray                = objc.GetClass("NSArray")
	_objectAtIndex          = objc.RegisterName("objectAtIndex:")
	_arrayWithObjects_count = objc.RegisterName("arrayWithObjects:count:")
	_addObject              = objc.RegisterName("addObject:")
	_getBytesLength         = objc.RegisterName("getBytes:length:")
	_dataWithBytesLength    = objc.RegisterName("dataWithBytes:length:")

	_NSData               = objc.GetClass("NSData")
	_NSString             = objc.GetClass("NSString")
	_UTF8String           = objc.RegisterName("UTF8String")
	_stringWithUTF8String = objc.RegisterName("stringWithUTF8String:")

	_NSURL           = objc.GetClass("NSURL")
	_fileURLWithPath = objc.RegisterName("fileURLWithPath:")

	_init   = objc.RegisterName("init")
	_alloc  = objc.RegisterName("alloc")
	_length = objc.RegisterName("length")
	_count  = objc.RegisterName("count")
)

func initialize() error { return nil }

func read(t Format) (buf []byte, err error) {
	switch t {
	// case FmtText:
	// 	return read_text(), nil
	// case FmtImage:
	// 	return read_image(), nil
	// case FmtFilepath:
	// 	return read_files(), nil
	}
	return nil, err_unavailable
}

func write(t Format, buf []byte) (<-chan struct{}, error) {
	// var ok bool
	switch t {
	// case FmtText:
	// 	if len(buf) == 0 {
	// 		ok = write_text(nil)
	// 	} else {
	// 		ok = write_text(buf)

	// 	}
	// case FmtImage:
	// 	if len(buf) == 0 {
	// 		ok = write_image(nil)
	// 	} else {
	// 		ok = write_image(buf)
	// 	}
	// case FmtFilepath:
	// 	if len(buf) == 0 {
	// 		ok = write_files(nil)
	// 	} else {
	// 		ok = write_files(buf)
	// 	}
	default:
		return nil, err_unsupported
	}
	// if !ok {
	// 	return nil, err_unavailable
	// }
	changed := make(chan struct{}, 1)
	cnt := get_change_count()
	go func() {
		for {
			// not sure if we are too slow or the user too fast :)
			time.Sleep(time.Second)
			cur := get_change_count()
			if cnt != cur {
				changed <- struct{}{}
				close(changed)
				return
			}
		}
	}()
	return changed, nil
}

func watch(ctx context.Context) <-chan ClipboardContent {
	recv := make(chan ClipboardContent, 1)
	ti := time.NewTicker(time.Second)
	prev_count := get_change_count()
	go func() {
		for {
			select {
			case <-ctx.Done():
				close(recv)
				return
			case <-ti.C:
				cur_count := get_change_count()
				if prev_count != cur_count {
					prev_count = cur_count

					content := read_content_with_type(ContentTypeParams{IsEnabled: false})
					recv <- content
				}
			}
		}
	}()
	return recv
}

func read_content_with_type(params ContentTypeParams) ClipboardContent {
	cur_types := get_content_types(params)
	var maybe_type string
	for _, t := range cur_types {
		if t == "public.html" {
			maybe_type = t
			text, err := read_html()
			d := ClipboardContent{
				Type:  maybe_type,
				Data:  text,
				Error: nil,
			}
			if err != nil {
				d.Error = fmt.Errorf("读取类型为 %v 的内容时失败，因为%v", maybe_type, err.Error())
			}
			return d
		}
		if t == "public.utf8-plain-text" {
			maybe_type = t
			text, err := read_text()
			d := ClipboardContent{
				Type:  maybe_type,
				Data:  text,
				Error: nil,
			}
			if err != nil {
				d.Error = fmt.Errorf("读取类型为 %v 的内容时失败，因为%v", maybe_type, err.Error())
			}
			return d
		}
		if t == "public.file-url" {
			maybe_type = t
			files, err := read_files()
			d := ClipboardContent{
				Type:  maybe_type,
				Data:  files,
				Error: nil,
			}
			if err != nil {
				d.Error = fmt.Errorf("读取类型为 %v 的内容时失败，因为%v", maybe_type, err.Error())
			}
			return d

		}
		if t == "public.png" {
			maybe_type = t
			image, err := read_image()
			d := ClipboardContent{
				Type:  maybe_type,
				Data:  image,
				Error: nil,
			}
			if err != nil {
				d.Error = fmt.Errorf("读取类型为 %v 的内容时失败，因为%v", maybe_type, err.Error())
			}
			return d
		}
	}
	type_text := strings.Join(cur_types, "\n")
	return ClipboardContent{
		Type:  type_text,
		Data:  nil,
		Error: fmt.Errorf("无法处理的内容类型"),
	}
}

func read_text() (string, error) {
	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	__data := __pasteboard.Send(_dataForType, _NSPasteboardTypeString)
	// __data := __pasteboard.Send(_dataForType, _NSPasteboardTypeHTML)
	if __data == 0 {
		return "", fmt.Errorf("读取数据失败")
	}
	size := uint(__data.Send(_length))
	if size == 0 {
		return "", fmt.Errorf("获取文本长度失败")
	}
	out := make([]byte, size)
	__r := __data.Send(_getBytesLength, unsafe.SliceData(out), size)
	if __r == 0 {
		return "", fmt.Errorf("转换数据失败")
	}
	text := string(out)
	return text, nil
}

func read_html() (string, error) {
	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	__data := __pasteboard.Send(_dataForType, _NSPasteboardTypeHTML)
	if __data == 0 {
		return "", fmt.Errorf("读取数据失败")
	}
	size := uint(__data.Send(_length))
	if size == 0 {
		return "", fmt.Errorf("获取文本长度失败")
	}
	out := make([]byte, size)
	__r := __data.Send(_getBytesLength, unsafe.SliceData(out), size)
	if __r == 0 {
		return "", fmt.Errorf("转换数据失败")
	}
	text := string(out)
	return text, nil
}

func read_image() ([]byte, error) {
	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	__data := __pasteboard.Send(_dataForType, _NSPasteboardTypePNG)
	if __data == 0 {
		return nil, fmt.Errorf("读取数据失败")
	}
	size := uint(__data.Send(_length))
	if size == 0 {
		return nil, fmt.Errorf("图片内容为空")
	}
	out := make([]byte, size)
	__r := __data.Send(_getBytesLength, unsafe.SliceData(out), size)
	if __r == 0 {
		return nil, fmt.Errorf("转换数据失败")
	}
	return out, nil
}

func read_files() ([]string, error) {
	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	__data := __pasteboard.Send(_propertyListForType, _NSPasteboardTypeFiles)
	if __data == 0 {
		return nil, fmt.Errorf("读取内容失败")
	}
	count := uint(__data.Send(_count))
	if count == 0 {
		return nil, fmt.Errorf("没有找到文件")
	}
	var files []string
	for i := 0; i < int(count); i++ {
		__file := __data.Send(_objectAtIndex, i)
		utf8_ptr := unsafe.Pointer(__file.Send(_UTF8String))
		if utf8_ptr == nil {
			continue
		}
		files = append(files, pointer_to_utf8_string(utf8_ptr))
	}
	return files, nil
}

func write_text(text string) error {
	bytes := []byte(text)
	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	if __pasteboard == 0 {
		return fmt.Errorf("获取粘贴板失败")
	}
	__data := objc.ID(_NSData).Send(_dataWithBytesLength, unsafe.SliceData(bytes), len(bytes))
	if __data == 0 {
		return fmt.Errorf("初始化数据失败")
	}
	__r := __pasteboard.Send(_clearContents)
	if __r == 0 {
		return fmt.Errorf("清空粘贴板失败")
	}
	__r2 := __pasteboard.Send(_setDataForType, __data, _NSPasteboardTypeString)
	if __r2 == 0 {
		return fmt.Errorf("写入文本失败")
	}
	return nil
}

func write_html(text string) error {
	bytes := []byte(text)
	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	if __pasteboard == 0 {
		return fmt.Errorf("获取粘贴板失败")
	}
	__data := objc.ID(_NSData).Send(_dataWithBytesLength, unsafe.SliceData(bytes), len(bytes))
	if __data == 0 {
		return fmt.Errorf("初始化数据失败")
	}
	__r := __pasteboard.Send(_clearContents)
	if __r == 0 {
		return fmt.Errorf("清空粘贴板失败")
	}
	__r2 := __pasteboard.Send(_setDataForType, __data, _NSPasteboardTypeHTML)
	if __r2 == 0 {
		return fmt.Errorf("写入文本失败")
	}
	return nil
}

func write_image(bytes []byte) error {
	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	if __pasteboard == 0 {
		return fmt.Errorf("获取粘贴板失败")
	}
	__data := objc.ID(_NSData).Send(_dataWithBytesLength, unsafe.SliceData(bytes), len(bytes))
	if __data == 0 {
		return fmt.Errorf("初始化数据失败")
	}
	__r := __pasteboard.Send(_clearContents)
	if __r == 0 {
		return fmt.Errorf("清空粘贴板失败")
	}
	__r2 := __pasteboard.Send(_setDataForType, __data, _NSPasteboardTypePNG)
	if __r2 == 0 {
		return fmt.Errorf("写入图片失败")
	}
	return nil
}

func write_files(files []string) error {
	__arr := objc.ID(_NSMutableArray).Send(_alloc).Send(_init)
	if __arr == 0 {
		return fmt.Errorf("初始化失败")
	}
	for _, f := range files {
		file_str := (*int8)(unsafe.Pointer(&[]byte(f + "\x00")[0]))
		__file_str := objc.ID(_NSString).Send(_stringWithUTF8String, file_str)
		__file_url := objc.ID(_NSURL).Send(_fileURLWithPath, __file_str)
		__arr.Send(_addObject, __file_url)
	}

	__pasteboard := objc.ID(_NSPasteboard).Send(_generalPasteboard)
	if __pasteboard == 0 {
		return fmt.Errorf("获取粘贴板失败")
	}
	__r := __pasteboard.Send(_clearContents)
	if __r == 0 {
		return fmt.Errorf("清空粘贴板失败")
	}
	__r2 := __pasteboard.Send(_writeObjects, __arr)
	if __r2 == 0 {
		return fmt.Errorf("写入文件失败")
	}
	__r3 := __pasteboard.Send(_propertyListForType, _NSPasteboardTypeFiles)
	if __r3 == 0 {
		return fmt.Errorf("写入文件失败2")
	}
	return nil
}

func get_change_count() int {
	return int(objc.ID(_NSPasteboard).Send(_generalPasteboard).Send(_changeCount))
}
func get_content_types(params ContentTypeParams) []string {
	if !params.IsEnabled {
		// ...
	}
	__data := objc.ID(_NSPasteboard).Send(_generalPasteboard).Send(_types)
	__array := objc.ID(__data)
	count := int(__array.Send(_count))
	var strs []string
	for i := 0; i < count; i++ {
		__file := __array.Send(_objectAtIndex, int(i))
		utf8_ptr := unsafe.Pointer(__file.Send(_UTF8String))
		if utf8_ptr == nil {
			continue
		}
		strs = append(strs, pointer_to_utf8_string(utf8_ptr))
	}
	return strs
}

func utf8_str_to_const(s string) *int8 {
	return (*int8)(unsafe.Pointer(&[]byte(s + "\x00")[0]))
}

func pointer_to_utf8_string(ptr unsafe.Pointer) string {
	if ptr == nil {
		return ""
	}
	var length int
	for ; *(*byte)(unsafe.Pointer(uintptr(ptr) + uintptr(length))) != 0; length++ {
	}
	bytes := make([]byte, length)
	for i := 0; i < length; i++ {
		bytes[i] = *(*byte)(unsafe.Pointer(uintptr(ptr) + uintptr(i)))
	}
	return string(bytes)
}
