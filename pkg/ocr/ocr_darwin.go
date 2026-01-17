//go:build darwin
// +build darwin

package ocr

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Foundation -framework Vision -framework CoreGraphics -framework AppKit
#include <stdlib.h>
#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <AppKit/AppKit.h>

char* recognize_text_from_bytes(void* data, int len, const char* lang) {
    @autoreleasepool {
        NSData* imgData = [NSData dataWithBytes:data length:len];
        NSImage* image = [[NSImage alloc] initWithData:imgData];
        if (!image) { return NULL; }
        CGImageRef cgImage = [image CGImageForProposedRect:NULL context:nil hints:nil];
        if (!cgImage) { return NULL; }
        VNImageRequestHandler* handler = [[VNImageRequestHandler alloc] initWithCGImage:cgImage options:@{}];
        __block NSMutableString* result = [NSMutableString string];
        VNRecognizeTextRequest* request = [[VNRecognizeTextRequest alloc] init];
        request.usesLanguageCorrection = YES;
        NSError* err = nil;
        [handler performRequests:@[request] error:&err];
        if (err) { return NULL; }
        NSArray<VNRecognizedTextObservation*>* observations = request.results;
        for (VNRecognizedTextObservation* obs in observations) {
            NSArray<VNRecognizedText*>* candidates = [obs topCandidates:1];
            VNRecognizedText* top = candidates.count > 0 ? [candidates objectAtIndex:0] : nil;
            if (top) {
                [result appendString:top.string];
                [result appendString:@"\n"];
            }
        }
        const char* cstr = [result UTF8String];
        char* out = (char*)malloc(strlen(cstr)+1);
        strcpy(out, cstr);
        return out;
    }
}
*/
import "C"
import (
	"fmt"
	"unsafe"
)

func RecognizeBytes(img []byte, lang string) (string, error) {
	if len(img) == 0 {
		return "", fmt.Errorf("empty image")
	}
	ptr := unsafe.Pointer(&img[0])
	cLang := C.CString(lang)
	defer C.free(unsafe.Pointer(cLang))
	cstr := C.recognize_text_from_bytes(ptr, C.int(len(img)), cLang)
	if cstr == nil {
		return "", fmt.Errorf("ocr failed")
	}
	defer C.free(unsafe.Pointer(cstr))
	return C.GoString(cstr), nil
}

