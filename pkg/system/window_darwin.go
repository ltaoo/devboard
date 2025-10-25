//go:build darwin && !ios

package system

import (
	"fmt"
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

func get_window_title(v interface{}) (string, error) {
	__workspace := objc.ID(_NSWorkspace).Send(_sharedWorkspace)
	__app := __workspace.Send(_frontmostApplication)
	if __app == 0 {
		return "", fmt.Errorf("读取数据失败")
	}
	__data := __app.Send(_localizedName)
	if __data == 0 {
		return "", fmt.Errorf("读取数据失败")
	}
	utf8_ptr := unsafe.Pointer(__data.Send(_UTF8String))
	text := pointer_to_utf8_string(utf8_ptr)
	return text, nil
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
