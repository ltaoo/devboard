//go:build windows

package clipboard

// Interacting with Clipboard on Windows:
// https://docs.microsoft.com/zh-cn/windows/win32/dataxchg/using-the-clipboard

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"reflect"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/image/bmp"
)

// https://github.com/lxn/win/blob/a377121e959e22055dd01ed4bb2383e5bd02c238/user32.go#L1295
const (
	CF_TEXT            = 1
	CF_BITMAP          = 2
	CF_METAFILEPICT    = 3
	CF_SYLK            = 4
	CF_DIF             = 5
	CF_TIFF            = 6
	CF_OEMTEXT         = 7
	CF_DIB             = 8
	CF_PALETTE         = 9
	CF_PENDATA         = 10
	CF_RIFF            = 11
	CF_WAVE            = 12
	CF_UNICODETEXT     = 13
	CF_ENHMETAFILE     = 14
	CF_HDROP           = 15
	CF_LOCALE          = 16
	CF_DIBV5           = 17
	CF_OWNERDISPLAY    = 0x0080
	CF_DSPTEXT         = 0x0081
	CF_DSPBITMAP       = 0x0082
	CF_DSPMETAFILEPICT = 0x0083
	CF_DSPENHMETAFILE  = 0x008E
	CF_GDIOBJFIRST     = 0x0300
	CF_GDIOBJLAST      = 0x03FF
	CF_PRIVATEFIRST    = 0x0200
	CF_PRIVATELAST     = 0x02FF
	CF_PRIVATE_TYPE1   = 49297
	CF_MAYBE_HTML      = 49845
	CF_MAYBE_OFFICE    = 49847
)
const (
	CP_UTF8 = 65001
	// Screenshot taken from special shortcut is in different format (why??), see:
	// https://jpsoft.com/forums/threads/detecting-clipboard-format.5225/
	cFmtDataObject = 49161 // Shift+Win+s, returned from enumClipboardFormats

	gmemMoveable   = 0x0002
	WM_DROPFILES   = 0x0233
	DIB_RGB_COLORS = 0x0000
	BI_RGB         = 0x0000
	CBM_INIT       = 0x04

	fileHeaderLen = 14
	infoHeaderLen = 40

	// Use GL_IMAGES for GamutMappingIntent
	// Other options:
	LCS_GM_ABS_COLORIMETRIC = 0x00000008
	LCS_GM_BUSINESS         = 0x00000001
	LCS_GM_GRAPHICS         = 0x00000002
	LCS_GM_IMAGES           = 0x00000004
	// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-wmf/9fec0834-607d-427d-abd5-ab240fb0db38

	// Use calibrated RGB values as Go's image/png assumes linear color space.
	// Other options:
	LCS_CALIBRATED_RGB      = 0x00000000
	LCS_sRGB                = 0x73524742
	LCS_WINDOWS_COLOR_SPACE = 0x57696E20
	// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-wmf/eb4bbd50-b3ce-4917-895c-be31f214797f
)

//	type bitmapHeader struct {
//		Type       int32
//		Width      int32
//		Height     int32
//		WidthBytes int32
//		Planes     uint16
//		BitsPixel  uint16
//		Bits       interface{}
//	}
//
// DWORD uint32
// LONG int32
// WORD uint16
type bitmap struct {
	bmType       int32
	bmWidth      int32
	bmHeight     int32
	bmWidthBytes int32
	bmPlanes     uint16
	bmBitPixel   uint16
	bmBits       uintptr
}

type bitmapHeader struct {
	Size          uint32
	Width         uint32
	Height        uint32
	PLanes        uint16
	BitsPixel     uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPelsPerMeter uint32
	YPelsPerMeter uint32
	ClrUsed       uint32
	ClrImportant  uint32
}

// BITMAPV5Header structure, see:
// https://docs.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-bitmapv5header
type bitmapV5Header struct {
	Size          uint32
	Width         int32
	Height        int32
	Planes        uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPelsPerMeter int32
	YPelsPerMeter int32
	ClrUsed       uint32
	ClrImportant  uint32
	RedMask       uint32
	GreenMask     uint32
	BlueMask      uint32
	AlphaMask     uint32
	CSType        uint32
	Endpoints     struct {
		CiexyzRed, CiexyzGreen, CiexyzBlue struct {
			CiexyzX, CiexyzY, CiexyzZ int32 // FXPT2DOT30
		}
	}
	GammaRed    uint32
	GammaGreen  uint32
	GammaBlue   uint32
	Intent      uint32
	ProfileData uint32
	ProfileSize uint32
	Reserved    uint32
}

type HDROPHeader struct {
	pFiles uint32
	x      int16
	y      int16
	fNC    uint32
	fWide  uint32
}

type BitmapFileHeader struct {
	// bfType     uint16
	// bfSize     uint32
	// bfReserved uint16
	// bfOffBits  uint32
	bfType     [2]byte
	bfSize     uint32
	bfReserved [2]uint16
	bfOffBits  uint32
}

type BitmapInfoHeader struct {
	Size          uint32
	Width         int32
	Height        int32
	Planes        uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPelsPerMeter int32
	YPelsPerMeter int32
	ClrUsed       uint32
	ClrImportant  uint32
}

type RGBQuad struct {
	rgbBlue     uint8
	rgbGreen    uint8
	rgbRed      uint8
	rgbReserved uint8
}

type BitmapInfo struct {
	bmiHeader BitmapInfoHeader
	// bmiHeader BitmapInfo
	bmiColors [1]RGBQuad
}

// 定义Point结构体
type Point struct {
	x int32
	y int32
}

// 定义DropFiles结构体
type DropFiles struct {
	p_files uint32
	pt      Point
	f_nc    int32
	f_wide  int32
}

// Calling a Windows DLL, see:
// https://github.com/golang/go/wiki/WindowsDLLs
var (
	user32 = syscall.MustLoadDLL("user32")
	// Opens the clipboard for examination and prevents other
	// applications from modifying the clipboard content.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-openclipboard
	_openClipboard = user32.MustFindProc("OpenClipboard")
	// Closes the clipboard.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-closeclipboard
	closeClipboard = user32.MustFindProc("CloseClipboard")
	// Empties the clipboard and frees handles to data in the clipboard.
	// The function then assigns ownership of the clipboard to the
	// window that currently has the clipboard open.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-emptyclipboard
	emptyClipboard = user32.MustFindProc("EmptyClipboard")
	// Retrieves data from the clipboard in a specified format.
	// The clipboard must have been opened previously.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboarddata
	getClipboardData = user32.MustFindProc("GetClipboardData")
	// Places data on the clipboard in a specified clipboard format.
	// The window must be the current clipboard owner, and the
	// application must have called the OpenClipboard function. (When
	// responding to the WM_RENDERFORMAT message, the clipboard owner
	// must not call OpenClipboard before calling SetClipboardData.)
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setclipboarddata
	setClipboardData = user32.MustFindProc("SetClipboardData")
	// Determines whether the clipboard contains data in the specified format.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-isclipboardformatavailable
	isClipboardFormatAvailable = user32.MustFindProc("IsClipboardFormatAvailable")
	// Clipboard data formats are stored in an ordered list. To perform
	// an enumeration of clipboard data formats, you make a series of
	// calls to the EnumClipboardFormats function. For each call, the
	// format parameter specifies an available clipboard format, and the
	// function returns the next available clipboard format.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-isclipboardformatavailable
	enumClipboardFormats = user32.MustFindProc("EnumClipboardFormats")
	// Retrieves the clipboard sequence number for the current window station.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardsequencenumber
	getClipboardSequenceNumber = user32.MustFindProc("GetClipboardSequenceNumber")
	getClipboardFormatNameA    = user32.MustFindProc("GetClipboardFormatNameA")
	// Registers a new clipboard format. This format can then be used as
	// a valid clipboard format.
	// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerclipboardformata
	registerClipboardFormatA = user32.MustFindProc("RegisterClipboardFormatA")
	registerClipboardFormatW = user32.MustFindProc("RegisterClipboardFormatW")
	// lstrcpyW                 = user32.MustFindProc("lstrcpyW")
	getDC     = user32.MustFindProc("GetDC")
	releaseDC = user32.MustFindProc("ReleaseDC")

	libgdi32       = syscall.NewLazyDLL("gdi32")
	getDIBits      = libgdi32.NewProc("GetDIBits")
	createDIBitmap = libgdi32.NewProc("CreateDIBitmap")
	getObjectW     = libgdi32.NewProc("GetObjectW")

	shell32       = syscall.NewLazyDLL("shell32")
	dragQueryFile = shell32.NewProc("DragQueryFileW")

	kernel32 = syscall.NewLazyDLL("kernel32")

	// Locks a global memory object and returns a pointer to the first
	// byte of the object's memory block.
	// https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-globallock
	gLock               = kernel32.NewProc("GlobalLock")
	gSize               = kernel32.NewProc("GlobalSize")
	multiByteToWideChar = kernel32.NewProc("MultiByteToWideChar")
	// Decrements the lock count associated with a memory object that was
	// allocated with GMEM_MOVEABLE. This function has no effect on memory
	// objects allocated with GMEM_FIXED.
	// https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-globalunlock
	gUnlock = kernel32.NewProc("GlobalUnlock")
	// Allocates the specified number of bytes from the heap.
	// https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-globalalloc
	gAlloc = kernel32.NewProc("GlobalAlloc")
	// Frees the specified global memory object and invalidates its handle.
	// https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-globalfree
	gFree   = kernel32.NewProc("GlobalFree")
	memMove = kernel32.NewProc("RtlMoveMemory")
)

func initialize() error { return nil }

func read(t Format) (buf []byte, err error) {
	// On Windows, OpenClipboard and CloseClipboard must be executed on
	// the same thread. Thus, lock the OS thread for further execution.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	var format uintptr
	switch t {
	// case FmtImage:
	// 	format = CF_DIBV5
	// case FmtFilepath:
	// 	format = CF_HDROP
	// case FmtText:
	// 	fallthrough
	// default:
	// 	format = CF_UNICODETEXT
	}

	// check if clipboard is avaliable for the requested format
	r, _, err := isClipboardFormatAvailable.Call(format)
	if r == 0 {
		return nil, err_unavailable
	}

	// try again until open clipboard successed
	for {
		r, _, _ = _openClipboard.Call()
		if r == 0 {
			continue
		}
		break
	}
	defer closeClipboard.Call()

	switch format {
	// case CF_DIBV5:
	// 	return readImage()
	// case CF_HDROP:
	// 	return readFilepaths()
	// case CF_UNICODETEXT:
	// 	fallthrough
	// default:
	// 	return readText()
	}
	return nil, nil
}

// write writes the given data to clipboard and
// returns true if success or false if failed.
func write(t Format, buf []byte) (<-chan struct{}, error) {
	errch := make(chan error)
	changed := make(chan struct{}, 1)
	go func() {
		// make sure GetClipboardSequenceNumber happens with
		// OpenClipboard on the same thread.
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		for {
			r, _, _ := _openClipboard.Call(0)
			if r == 0 {
				continue
			}
			break
		}

		// var param uintptr
		switch t {
		// case FmtImage:
		// 	err := write_image(buf)
		// 	if err != nil {
		// 		errch <- err
		// 		closeClipboard.Call()
		// 		return
		// 	}
		// case FmtFilepath:
		// 	err := write_files(buf)
		// 	if err != nil {
		// 		errch <- err
		// 		closeClipboard.Call()
		// 		return
		// 	}
		// case FmtText:
		// 	fallthrough
		// default:
		// 	// param = CF_UNICODETEXT
		// 	err := write_text(buf)
		// 	if err != nil {
		// 		errch <- err
		// 		closeClipboard.Call()
		// 		return
		// 	}
		}
		// Close the clipboard otherwise other applications cannot
		// paste the data.
		closeClipboard.Call()

		cnt, _, _ := getClipboardSequenceNumber.Call()
		errch <- nil
		for {
			time.Sleep(time.Second)
			cur, _, _ := getClipboardSequenceNumber.Call()
			if cur != cnt {
				changed <- struct{}{}
				close(changed)
				return
			}
		}
	}()
	err := <-errch
	if err != nil {
		return nil, err
	}
	return changed, nil
}

func watch(ctx context.Context) <-chan ClipboardContent {
	recv := make(chan ClipboardContent, 1)
	ready := make(chan struct{})
	go func() {
		// not sure if we are too slow or the user too fast :)
		ti := time.NewTicker(time.Second)
		prev_count, _, _ := getClipboardSequenceNumber.Call()
		ready <- struct{}{}
		for {
			select {
			case <-ctx.Done():
				close(recv)
				return
			case <-ti.C:
				cur_count, _, _ := getClipboardSequenceNumber.Call()
				if prev_count != cur_count {
					prev_count = cur_count
					content := read_content_with_type()
					recv <- content
				}
			}
		}
	}()
	<-ready
	return recv
}

func read_content_with_type() ClipboardContent {
	open_clipboard()
	defer close_clipboard()
	cur_types := get_content_types(ContentTypeParams{IsEnabled: true})
	// fmt.Println("after get_content_types", cur_types)
	if len(cur_types) == 0 {
		d := ClipboardContent{
			Type:  "",
			Data:  "",
			Error: fmt.Errorf("没有读取到任意可用内容类型"),
		}
		return d
	}
	maybe_type := cur_types[0]
	if maybe_type == "public.utf8-plain-text" {
		b, err := read_text()
		d := ClipboardContent{
			Type:  maybe_type,
			Data:  b,
			Error: nil,
		}
		if err != nil {
			d.Error = fmt.Errorf("读取类型为 %v 的内容时失败", maybe_type)
		}
		return d
	}
	if maybe_type == "public.html" {
		b, err := read_html()
		d := ClipboardContent{
			Type:  maybe_type,
			Data:  b,
			Error: nil,
		}
		if err != nil {
			d.Error = fmt.Errorf("读取类型为 %v 的内容时失败", maybe_type)
		}
		return d
	}
	if maybe_type == "public.file-url" {
		b, err := read_files()
		d := ClipboardContent{
			Type:  maybe_type,
			Data:  b,
			Error: nil,
		}
		if err != nil {

			d.Error = fmt.Errorf("读取类型为 %v 的内容时失败", maybe_type)
		}
		return d
	}
	if maybe_type == "public.png" {
		b, err := read_image()
		d := ClipboardContent{
			Type:  maybe_type,
			Data:  b,
			Error: nil,
		}
		if err != nil {
			d.Error = fmt.Errorf("读取类型为 %v 的内容时失败", maybe_type)
		}
		return d
	}
	type_text := strings.Join(cur_types, "\n")
	return ClipboardContent{
		Type:  type_text,
		Data:  []byte{},
		Error: fmt.Errorf("无法处理的内容类型"),
	}
}

// read_text reads the clipboard and returns the text data if presents.
// The caller is responsible for opening/closing the clipboard before
// calling this function.
func read_text() (text string, err error) {
	open_clipboard()
	defer close_clipboard()
	hMem, _, err := getClipboardData.Call(CF_UNICODETEXT)
	if hMem == 0 {
		return "", err
	}
	p, _, err := gLock.Call(hMem)
	if p == 0 {
		return "", err
	}
	defer gUnlock.Call(hMem)

	// Find NUL terminator
	n := 0
	for ptr := unsafe.Pointer(p); *(*uint16)(ptr) != 0; n++ {
		ptr = unsafe.Pointer(uintptr(ptr) + unsafe.Sizeof(*((*uint16)(unsafe.Pointer(p)))))
	}

	var s []uint16
	h := (*reflect.SliceHeader)(unsafe.Pointer(&s))
	h.Data = p
	h.Len = n
	h.Cap = n
	return string(utf16.Decode(s)), nil
}

func read_html() (text string, err error) {
	open_clipboard()
	defer close_clipboard()
	r := register_clipboard_format("HTML Format")
	ret, _, _ := isClipboardFormatAvailable.Call(r)
	if ret == 0 {
		return "", fmt.Errorf("clipboard format not available")
	}
	hMem, _, err := getClipboardData.Call(r)
	if hMem == 0 {
		return "", err
	}
	ptr, _, err := gLock.Call(hMem)
	if ptr == 0 {
		return "", err
	}
	defer gUnlock.Call(hMem)
	// 转换为 Go 字符串
	data := byte_ptr_to_string((*byte)(unsafe.Pointer(ptr)))
	return data, nil
}

func read_image() ([]byte, error) {
	open_clipboard()
	defer close_clipboard()
	hMem, _, err := getClipboardData.Call(CF_BITMAP)
	if hMem == 0 {
		return nil, fmt.Errorf("找不到数据")
	}
	// p, _, err := gLock.Call(hMem)
	// if p == 0 {
	// 	return nil, fmt.Errorf("锁定内存失败，%v", err.Error())
	// }
	// defer gUnlock.Call(hMem)
	p := hMem

	var bitmap bitmap
	r, _, err := getObjectW.Call(uintptr(p), uintptr(unsafe.Sizeof(bitmap)), uintptr(unsafe.Pointer(&bitmap)))
	fmt.Println("the result getObjectW", r, err.Error(), bitmap.bmPlanes, bitmap.bmBitPixel)
	if r == 0 {
		return nil, fmt.Errorf("获取图片信息失败，%v", err.Error())
	}

	clr_bits := int(bitmap.bmPlanes) * int(bitmap.bmBitPixel)

	header_storage_size := uintptr(unsafe.Sizeof(BitmapInfoHeader{}))
	if clr_bits <= 24 {
		header_storage_size = uintptr(unsafe.Sizeof(BitmapInfoHeader{})) + uintptr(unsafe.Sizeof(RGBQuad{}))*(1<<uintptr(clr_bits))
	}
	header_storage := make([]byte, header_storage_size)
	info := (*BitmapInfo)(unsafe.Pointer(&header_storage[0]))

	info.bmiHeader.Size = uint32(unsafe.Sizeof(BitmapInfoHeader{}))
	info.bmiHeader.Width = bitmap.bmWidth
	info.bmiHeader.Height = bitmap.bmHeight
	info.bmiHeader.Planes = bitmap.bmPlanes
	info.bmiHeader.BitCount = bitmap.bmBitPixel
	info.bmiHeader.Compression = BI_RGB
	if clr_bits <= 24 {
		info.bmiHeader.ClrUsed = 1 << uint32(clr_bits)
	}
	info.bmiHeader.SizeImage = uint32((((info.bmiHeader.Width*int32(clr_bits) + 31) &^ 31) / 8) * info.bmiHeader.Height)
	info.bmiHeader.ClrImportant = 0

	header := &info.bmiHeader

	// fmt.Println("the header", header.BitCount, header.Width, header.PLanes, header.BitsPixel, header.PLanes*header.BitsPixel)
	buffer := make([]byte, int(header.SizeImage))

	// data := make([]byte, header.SizeImage)
	hdc, _, err := getDC.Call(0)
	if hdc == 0 {
		return nil, fmt.Errorf("GetDC failed: %v", err)
	}
	defer func() {
		r, _, err := releaseDC.Call(0, hdc)
		if r == 0 {
			fmt.Printf("ReleaseDC failed: %v\n", err)
		}
	}()
	r, _, err = getDIBits.Call(
		hdc,
		p,
		0,
		uintptr(header.Height),
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(unsafe.Pointer(info)),
		DIB_RGB_COLORS)
	if r == 0 {
		return nil, fmt.Errorf("GetDIBits failed: %v", err)
	}
	if err.Error() != "The operation completed successfully." {
		return nil, fmt.Errorf("GetDIBits failed: %v", err)
	}
	fmt.Println("the data read using GetDIBits", len(buffer), header.Size)
	img := image.NewRGBA(image.Rect(0, 0, int(header.Width), int(header.Height)))

	offset := 0
	stride := int(header.Width)
	for y := 0; y < int(header.Height); y++ {
		for x := 0; x < int(header.Width); x++ {
			xhat := (x + int(header.Width)) % int(header.Width)
			yhat := int(header.Height) - 1 - y
			idx := offset + 4*(y*stride+x)
			r := buffer[idx+2]
			g := buffer[idx+1]
			b := buffer[idx+0]
			a := uint8(0xff)
			// a := data[idx+3]
			img.SetRGBA(xhat, yhat, color.RGBA{r, g, b, a})
		}
	}
	var buf bytes.Buffer
	png.Encode(&buf, img)
	return buf.Bytes(), nil
}

func read_image_dib() ([]byte, error) {
	open_clipboard()
	defer close_clipboard()
	hMem, _, _ := getClipboardData.Call(CF_DIB)
	if hMem != 0 {
		return nil, fmt.Errorf("not dib format data")
	}
	p, _, err := gLock.Call(hMem)
	if p == 0 {
		return nil, fmt.Errorf("failed to call global lock, %v", err.Error())
	}
	defer gUnlock.Call(hMem)

	bmpHeader := (*bitmapHeader)(unsafe.Pointer(p))
	dataSize := bmpHeader.SizeImage + fileHeaderLen + infoHeaderLen

	if bmpHeader.SizeImage == 0 && bmpHeader.Compression == 0 {
		iSizeImage := bmpHeader.Height * ((bmpHeader.Width*uint32(bmpHeader.BitCount)/8 + 3) &^ 3)
		dataSize += iSizeImage
	}
	buf := new(bytes.Buffer)
	binary.Write(buf, binary.LittleEndian, uint16('B')|(uint16('M')<<8))
	binary.Write(buf, binary.LittleEndian, uint32(dataSize))
	binary.Write(buf, binary.LittleEndian, uint32(0))
	const sizeof_colorbar = 0
	binary.Write(buf, binary.LittleEndian, uint32(fileHeaderLen+infoHeaderLen+sizeof_colorbar))
	j := 0
	for i := fileHeaderLen; i < int(dataSize); i++ {
		binary.Write(buf, binary.BigEndian, *(*byte)(unsafe.Pointer(p + uintptr(j))))
		j++
	}
	return bmp_to_png(buf)
}

// https://stackoverflow.com/questions/77205618/when-a-file-is-on-the-windows-clipboard-how-can-i-in-python-access-its-path
func read_files() ([]string, error) {
	open_clipboard()
	defer close_clipboard()
	hMem, _, err := getClipboardData.Call(CF_HDROP)
	if hMem == 0 {
		// fmt.Println("f1", err.Error())
		return nil, err
	}
	p, _, err := gLock.Call(hMem)
	if p == 0 {
		// fmt.Println("f2", err.Error())
		return nil, err
	}
	defer gUnlock.Call(hMem)

	// 验证HDROP结构的内存布局
	type HDROPHeader struct {
		pFiles uint32
		x      int16
		y      int16
		fNC    uint32
		fWide  uint32
	}

	var count uint32
	ret, _, err := dragQueryFile.Call(p, uintptr(^uint32(0)), 0, 0, uintptr(unsafe.Sizeof(count)), uintptr(unsafe.Pointer(&count)))
	if ret == 0 {
		// fmt.Println("f3", err.Error())
		return nil, fmt.Errorf("DragQueryFile (to get count) failed: %w", err)
	}

	// fmt.Println("num files", ret, v, err)
	fileCount := uint32(ret)

	// // 存储文件路径
	filePaths := make([]string, fileCount)
	for i := uint32(0); i < fileCount; i++ {
		// 获取文件路径所需长度（不包含 null 终止符）
		var length uint32
		ret, _, err = dragQueryFile.Call(p, uintptr(i), 0, 0, uintptr(unsafe.Sizeof(length)), uintptr(unsafe.Pointer(&length)))
		if ret == 0 {
			return nil, fmt.Errorf("DragQueryFile (to get length) for file %d failed: %w", i, err)
		}
		length = uint32(ret)

		buffer := make([]uint16, length+1)
		ret, _, err = dragQueryFile.Call(p, uintptr(i), uintptr(unsafe.Pointer(&buffer[0])), uintptr(len(buffer)*2))
		if ret == 0 {
			return nil, fmt.Errorf("DragQueryFile (to get path) for file %d failed: %w", i, err)
		}

		filePaths = append(filePaths, syscall.UTF16ToString(buffer[:length]))
	}
	return filePaths, nil
	// joinedPaths := strings.Join(filePaths, "\n")
	// return []byte(joinedPaths), nil
}

// write_text writes given data to the clipboard. It is the caller's
// responsibility for opening/closing the clipboard before calling
// this function.
func write_text(text string) error {
	if text == "" {
		return fmt.Errorf("The text is empty")
	}
	open_clipboard()
	defer close_clipboard()
	r, _, err := emptyClipboard.Call()
	if r == 0 {
		return fmt.Errorf("failed to clear clipboard: %w", err)
	}
	s, err := syscall.UTF16FromString(text)
	if err != nil {
		return fmt.Errorf("failed to convert given string: %w", err)
	}

	hMem, _, err := gAlloc.Call(gmemMoveable, uintptr(len(s)*int(unsafe.Sizeof(s[0]))))
	if hMem == 0 {
		return fmt.Errorf("failed to alloc global memory: %w", err)
	}

	p, _, err := gLock.Call(hMem)
	if p == 0 {
		return fmt.Errorf("failed to lock global memory: %w", err)
	}
	defer gUnlock.Call(hMem)

	memMove.Call(p, uintptr(unsafe.Pointer(&s[0])), uintptr(len(s)*int(unsafe.Sizeof(s[0]))))

	v, _, err := setClipboardData.Call(CF_UNICODETEXT, hMem)
	if v == 0 {
		gFree.Call(hMem)
		return fmt.Errorf("failed to set text to clipboard: %w", err)
	}

	return nil
}

func write_image(image_bytes []byte) error {
	open_clipboard()
	defer close_clipboard()
	r, _, err := emptyClipboard.Call()
	if r == 0 {
		return fmt.Errorf("failed to clear clipboard: %w", err)
	}
	mimetype := http.DetectContentType(image_bytes)
	var file image.Image
	bmp_bytes := image_bytes
	if mimetype == "image/png" {
		file, err = png.Decode(bytes.NewReader(image_bytes))
		if err != nil {
			return fmt.Errorf("Decode PNG file failed, %v", err.Error())
		}
		var bmp_buf bytes.Buffer
		err = bmp.Encode(&bmp_buf, file)
		if err != nil {
			return fmt.Errorf("Convert to BMP file failed, %v", err.Error())
		}
		bmp_bytes = bmp_buf.Bytes()
	} else if mimetype == "image/jpeg" {
		file, err = jpeg.Decode(bytes.NewReader(image_bytes))
		if err != nil {
			return fmt.Errorf("Decode JPEG file failed, %v", err.Error())
		}
		var bmp_buf bytes.Buffer
		err = bmp.Encode(&bmp_buf, file)
		if err != nil {
			return fmt.Errorf("Convert to BMP file failed, %v", err.Error())
		}
		bmp_bytes = bmp_buf.Bytes()
	} else if mimetype == "image/bmp" {
	} else {
		return fmt.Errorf("Unsupported file type %v", mimetype)
	}

	// const FILE_HEADER_LENGTH = int(unsafe.Sizeof(BitmapFileHeader{}))
	const FILE_HEADER_LENGTH = 14
	const INFO_HEADER_LENGTH = int(unsafe.Sizeof(BitmapInfoHeader{}))

	// fmt.Println("the file header length and info header length", FILE_HEADER_LENGTH, INFO_HEADER_LENGTH)

	if len(bmp_bytes) < FILE_HEADER_LENGTH+INFO_HEADER_LENGTH {
		return fmt.Errorf("The buffer content is incorrect")
	}
	var file_header BitmapFileHeader
	file_header_data := (*[FILE_HEADER_LENGTH]byte)(unsafe.Pointer(&file_header))
	copy(file_header_data[:], bmp_bytes[:FILE_HEADER_LENGTH])
	file_header.bfOffBits = 54
	// fmt.Println("[]write image - after copy file header", len(buf), file_header)
	if len(bmp_bytes) <= int(file_header.bfOffBits) {
		return fmt.Errorf("The file content is incorrect")
	}

	var info_header BitmapInfoHeader
	info_header_data := (*[INFO_HEADER_LENGTH]byte)(unsafe.Pointer(&info_header))
	copy(info_header_data[:], bmp_bytes[FILE_HEADER_LENGTH:FILE_HEADER_LENGTH+INFO_HEADER_LENGTH])
	// fmt.Println("[]write image - after copy info header", info_header.SizeImage, info_header.Size)

	bitmap := bmp_bytes[file_header.bfOffBits:]
	if len(bitmap) < int(info_header.SizeImage) {
		return fmt.Errorf("The file content is incorrect")
	}

	hdc, _, err := getDC.Call(0)
	if hdc == 0 {
		return fmt.Errorf("GetDC failed, %v", err)
	}
	defer func() {
		r, _, err := releaseDC.Call(0, hdc)
		if r == 0 {
			fmt.Printf("ReleaseDC failed, %v\n", err)
		}
	}()

	r1, _, err := createDIBitmap.Call(
		hdc,
		uintptr(unsafe.Pointer(&info_header)),
		CBM_INIT,
		uintptr(unsafe.Pointer(&bitmap[0])),
		uintptr(unsafe.Pointer(&info_header)),
		DIB_RGB_COLORS,
	)
	if r1 == 0 {
		return fmt.Errorf("Create DIB file failed, %v", err.Error())
	}
	// defer win.DeleteObject(handle)
	r, _, err = setClipboardData.Call(CF_BITMAP, r1)
	if r == 0 {
		// return fmt.Errorf("设置剪贴板数据失败，错误码: %d", win.GetLastError())
		return fmt.Errorf("Write image to clipboard failed, %v", err.Error())
	}

	return nil
}

func write_files(files []string) error {
	open_clipboard()
	defer close_clipboard()
	ret, _, err := emptyClipboard.Call()
	if ret == 0 {
		return fmt.Errorf("failed to clear clipboard: %w", err)
	}

	var fileListSize uint32
	for _, path := range files {
		var count uint32
		ret, _, err := multiByteToWideChar.Call(
			CP_UTF8,
			0,
			uintptr(unsafe.Pointer(syscall.StringBytePtr(path))),
			uintptr(int32(len(path))),
			0,
			0,
		)
		if ret == 0 {
			return fmt.Errorf("MultiByteToWideChar (to get length) for path %s failed: %w", path, err)
		}
		count = uint32(ret)
		fileListSize += count + 1
	}

	if fileListSize == 0 {
		return fmt.Errorf("No valid file paths")
	}

	// 计算总内存大小
	dropfiles := DropFiles{
		p_files: uint32(unsafe.Sizeof(DropFiles{})),
		pt:      Point{x: 0, y: 0},
		f_nc:    0,
		f_wide:  1,
	}
	memSize := uintptr(unsafe.Sizeof(dropfiles)) + uintptr(fileListSize*2) + 2

	// 分配全局内存
	hMem, _, err := gAlloc.Call(0x0042, memSize)
	if hMem == 0 {
		return fmt.Errorf("GlobalAlloc failed: %w", err)
	}
	defer gFree.Call(hMem)

	// 锁定内存
	p, _, err := gLock.Call(hMem)
	if p == 0 {
		return fmt.Errorf("GlobalLock failed: %w", err)
	}
	defer gUnlock.Call(hMem)

	// 填充DROPFILES结构体
	ptr := (*DropFiles)(unsafe.Pointer(p))
	*ptr = dropfiles

	// 填充文件路径
	dataPtr := (*[1 << 30]uint16)(unsafe.Pointer(uintptr(p) + unsafe.Sizeof(dropfiles)))
	for _, path := range files {
		var count uint32
		ret, _, err := multiByteToWideChar.Call(
			CP_UTF8,
			0,
			uintptr(unsafe.Pointer(syscall.StringBytePtr(path))),
			uintptr(int32(len(path))),
			uintptr(unsafe.Pointer(&dataPtr[0])),
			uintptr(int32(fileListSize)),
		)
		if ret == 0 {
			return fmt.Errorf("MultiByteToWideChar (to write path) for path %s failed: %w", path, err)
		}
		count = uint32(ret)
		dataPtr = (*[1 << 30]uint16)(unsafe.Pointer(uintptr(unsafe.Pointer(&dataPtr[count])) + 2))
		// *dataPtr = 0
	}
	// 添加最终的null终止符
	// *(*uint16)(unsafe.Pointer(uintptr(unsafe.Pointer(dataPtr)) + 2)) = 0
	*(*uint16)(unsafe.Pointer(uintptr(unsafe.Pointer(dataPtr)) + 2)) = uint16(0)

	ret, _, err = setClipboardData.Call(CF_HDROP, hMem)
	if ret == 0 {
		return fmt.Errorf("SetClipboardData failed: %w", err)
	}
	return nil
}

func get_change_count() uintptr {
	cnt, _, _ := getClipboardSequenceNumber.Call()
	return cnt
}
func get_content_types(params ContentTypeParams) []string {
	if !params.IsEnabled {
		open_clipboard()
		defer close_clipboard()
	}
	format := uint(0)
	var types []string
	text_type_name := "public.utf8-plain-text"
	html_type_name := "public.html"
	image_type_name := "public.png"
	file_type_name := "public.file-url"
	append_text := func(to_head bool) {
		existing := Include(types, func(v string, idx int) bool {
			return v == text_type_name
		})
		if !existing {
			if to_head {
				types = append(types, "")
				copy(types[1:], types)
				types[0] = text_type_name
			} else {
				types = append(types, text_type_name)
			}
		}
	}
	append_html := func(to_head bool) {
		existing := Include(types, func(v string, idx int) bool {
			return v == html_type_name
		})
		if existing {
			return
		}
		if to_head {
			types = append(types, "")
			copy(types[1:], types)
			types[0] = html_type_name
			return
		}
		types = append(types, html_type_name)
	}
	append_png := func(to_head bool) {
		existing := Include(types, func(v string, idx int) bool {
			return v == image_type_name
		})
		if !existing {
			if to_head {
				types = append(types, "")
				copy(types[1:], types)
				types[0] = image_type_name
			} else {
				types = append(types, image_type_name)
			}
		}
	}
	append_file_url := func(to_head bool) {
		existing := Include(types, func(v string, idx int) bool {
			return v == file_type_name
		})
		if !existing {
			if to_head {
				types = append(types, "")
				copy(types[1:], types)
				types[0] = file_type_name
			} else {
				types = append(types, file_type_name)
			}
		}
	}
	var format_list []uint
	for {
		tt, _, err := enumClipboardFormats.Call(uintptr(format))
		// fmt.Println("after enumClipboardFormats", tt)
		format = uint(tt)
		format_list = append(format_list, format)
		if tt == 0 {
			if err.Error() != "The operation completed successfully." {
				fmt.Println("EnumClipboardFormats error:", err)
			}
			break
		}
		if tt == CF_TEXT {
			append_text(false)
		}
		if tt == CF_BITMAP {
			append_png(false)
		}
		if tt == CF_OEMTEXT {
			append_text(false)
		}
		if tt == CF_DIB {
			append_png(false)
		}
		if tt == CF_UNICODETEXT {
			append_text(false)
		}
		if tt == CF_LOCALE {
			append_text(false)
		}
		if tt == CF_DIBV5 {
			append_png(false)
		}
		if tt == CF_HDROP {
			append_file_url(false)
		}
		if tt == CF_MAYBE_HTML {
			append_html(true)
		}
		if tt == CF_MAYBE_OFFICE {
			append_html(true)
		}
	}

	// format := CF_TEXT
	// var types []string
	// register_clipboard_format("HTML Format")
	// one_type, _, err := enumClipboardFormats.Call(uintptr(format))
	// fmt.Println("cur type", one_type, uint(one_type))
	// if one_type == 0 {
	// 	if err.Error() != "The operation completed successfully." {
	// 		fmt.Println("EnumClipboardFormats error:", err)
	// 	}
	// 	one_type, _, _ := enumClipboardFormats.Call(uintptr(format))
	// 	fmt.Println("cur type", one_type, uint(one_type))
	// 	return []string{}
	// 	// break
	// }
	// if one_type == CF_OEMTEXT {
	// 	types = append(types, "public.utf8-plain-text")
	// }
	// if one_type == CF_DIBV5 {
	// 	types = append(types, "public.png")
	// }
	// if one_type == CF_HDROP {
	// 	types = append(types, "public.file-url")
	// }
	// return types
	// const max_length = 256
	// for _, f := range format_list {
	// 	buf := make([]byte, max_length)
	// 	ret, _, err := getClipboardFormatNameA.Call(uintptr(uint32(f)), uintptr(unsafe.Pointer(&buf[0])), uintptr(max_length))

	// 	if ret == 0 {
	// 		fmt.Println(err.Error())
	// 		continue
	// 	}
	// 	// n := 0
	// 	// for ptr := unsafe.Pointer(ret); *(*uint16)(ptr) != 0; n++ {
	// 	// 	ptr = unsafe.Pointer(uintptr(ptr) + unsafe.Sizeof(*((*uint16)(unsafe.Pointer(ret)))))
	// 	// }

	// 	// var s []uint16
	// 	// h := (*reflect.SliceHeader)(unsafe.Pointer(&s))
	// 	// h.Data = ret
	// 	// h.Len = n
	// 	// h.Cap = n
	// 	// text := string(utf16.Decode(s))
	// 	// fmt.Println(text)
	// 	n := 0
	// 	for n < len(buf) && buf[n] != 0 {
	// 		n++
	// 	}
	// 	str := string(buf[:n])
	// 	fmt.Println(f, str)
	// }
	return types
}
func open_clipboard() {
	for {
		r, _, _ := _openClipboard.Call()
		if r == 0 {
			continue
		}
		break
	}
}
func close_clipboard() {
	closeClipboard.Call()
}

func register_clipboard_format(format string) uintptr {
	ptr, _ := syscall.UTF16PtrFromString(format)
	ret, _, _ := registerClipboardFormatW.Call(uintptr(unsafe.Pointer(ptr)))
	return ret
}

func bmp_to_png(bmpBuf *bytes.Buffer) (buf []byte, err error) {
	var f bytes.Buffer
	original_image, err := bmp.Decode(bmpBuf)
	if err != nil {
		return nil, err
	}
	err = png.Encode(&f, original_image)
	if err != nil {
		return nil, err
	}
	return f.Bytes(), nil
}

func byte_slice_to_string_slice(b []byte) ([]string, error) {
	var strs []string
	err := json.Unmarshal(b, &strs)
	return strs, err
}

func byte_ptr_to_string(ptr *byte) string {
	if ptr == nil {
		return ""
	}
	var length int
	for {
		if *(*byte)(unsafe.Pointer(uintptr(unsafe.Pointer(ptr)) + uintptr(length))) == 0 {
			break
		}
		length++
	}
	return string((*[1 << 20]byte)(unsafe.Pointer(ptr))[:length:length])
}

func Include[T any](collection []T, iteratee func(item T, index int) bool) bool {
	for i, item := range collection {
		res := iteratee(item, i)
		if res {
			return true
		}
	}
	return false
}
