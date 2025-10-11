package douyinweb

import (
	"encoding/binary"
	"fmt"
	rand1 "math/rand"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/tjfoc/gmsm/sm3"
)

type ABogus struct {
	filter      *regexp.Regexp
	arguments   []int
	uaKey       string
	endString   string
	version     []int
	browser     string
	reg         []uint32
	str         map[string]string
	chunk       []byte
	size        int
	uaCode      []int
	browserLen  int
	browserCode []int
}

func NewABogus(platform string) *ABogus {
	ab := &ABogus{
		filter:    regexp.MustCompile(`%([0-9A-F]{2})`),
		arguments: []int{0, 1, 14},
		uaKey:     "\x00\x01\x0e",
		endString: "cus",
		version:   []int{1, 0, 1, 5},
		browser:   "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|MacIntel",
		reg: []uint32{
			1937774191,
			1226093241,
			388252375,
			3666478592,
			2842636476,
			372324522,
			3817729613,
			2969243214,
		},
		str: map[string]string{
			"s0": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
			"s1": "Dkdpgh4ZKsQB80/Mfvw36XI1R25+WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
			"s2": "Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
			"s3": "ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnryx9HVGDaStCe",
			"s4": "Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe",
		},
		uaCode: []int{
			76, 98, 15, 131, 97, 245, 224, 133, 122, 199, 241, 166, 79, 34, 90, 191,
			128, 126, 122, 98, 66, 11, 14, 40, 49, 110, 110, 173, 67, 96, 138, 252,
		},
	}

	if platform != "" {
		ab.browser = ab.generateBrowserInfo(platform)
	}
	bb := []rune(ab.browser)
	ab.browserLen = len(bb)
	ab.browserCode = ab.charCodeAt(ab.browser)

	return ab
}

func (ab *ABogus) list1(randomNum *int, a, b, c int) []int {
	return ab.randomList(randomNum, a, b, 1, 2, 5, c&a)
}

func (ab *ABogus) list2(randomNum *int, a, b int) []int {
	return ab.randomList(randomNum, a, b, 1, 0, 0, 0)
}

func (ab *ABogus) list3(randomNum *int, a, b int) []int {
	return ab.randomList(randomNum, a, b, 1, 0, 5, 0)
}

func (ab *ABogus) randomList(a *int, b, c, d, e, f, g int) []int {
	var r float64
	if a != nil {
		r = float64(*a)
	} else {
		r = rand1.Float64() * 10000
	}

	v := []int{
		int(r),
		int(r) & 255,
		int(r) >> 8,
	}

	s := v[1]&b | d
	v = append(v, s)

	s = v[1]&c | e
	v = append(v, s)

	s = v[2]&b | f
	v = append(v, s)

	s = v[2]&c | g
	v = append(v, s)

	return v[len(v)-4:]
}

func (ab *ABogus) fromCharCode(codes ...int) string {
	runes := make([]rune, len(codes))
	for i, code := range codes {
		runes[i] = rune(code)
	}
	result := string(runes)
	// fmt.Println("fromCharCode", len(codes), len(runes), len(result))
	return result
	// var buf bytes.Buffer
	// // var buf []string
	// for _, code := range codes {
	// 	buf.WriteRune(rune(code))
	// 	// buf = append(buf, fmt.Sprintf("%c", code))
	// }
	// result := buf.String()
	// fmt.Println("fromCharCode", len(codes), len(result))
	// // return buf.String()
	// return result
}

func (ab *ABogus) generateString1(randomNum1, randomNum2, randomNum3 *int) string {
	v1 := ab.list1(randomNum1, 170, 85, 45)
	v2 := ab.list2(randomNum2, 170, 85)
	v3 := ab.list3(randomNum3, 170, 85)
	result := ab.fromCharCode(v1...) +
		ab.fromCharCode(v2...) +
		ab.fromCharCode(v3...)
	return result
}

func (ab *ABogus) generateString2(urlParams, method string, startTime, endTime int64) string {
	// urlParams = "device_platform=webapp&aid=6383&channel=channel_pc_web&pc_client_type=1&version_code=290100&version_name=29.1.0&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=130.0.0.0&browser_online=true&engine_name=Blink&engine_version=130.0.0.0&os_name=Windows&os_version=10&cpu_core_num=12&device_memory=8&platform=PC&downlink=10&effective_type=4g&from_user_page=1&locate_query=false&need_time_list=1&pc_libra_divert=Windows&publish_video_strategy_type=2&round_trip_time=0&show_live_replay_strategy=1&time_list_query=0&whale_cut_token=&update_version_code=170400&msToken=&aweme_id=7372484719365098803"
	a := ab.generateString2List(urlParams, method, startTime, endTime)
	// fmt.Println("after generateString2List")
	// fmt.Println(a)
	e := ab.endCheckNum(a)
	a = append(a, ab.browserCode...)
	a = append(a, e)
	// fmt.Println(urlParams, method, startTime, endTime)
	vvv := ab.fromCharCode(a...)
	// fmt.Println("before rc4_encrypt")
	// fmt.Println(a)
	// fmt.Println(len(a), len(vvv))
	return ab.rc4_encrypt(vvv, "y")
}

func (ab *ABogus) generateString2List(urlParams, method string, startTime, endTime int64) []int {
	if startTime == 0 {
		startTime = time.Now().UnixNano() / int64(time.Millisecond)
	}
	if endTime == 0 {
		endTime = startTime + int64(rand1.Intn(5)+4)
	}

	paramsArray := ab.generateParamsCode(urlParams)
	methodArray := ab.generateMethodCode(method)

	return ab.list4(
		int((endTime>>24)&255),
		paramsArray[21],
		ab.uaCode[23],
		int((endTime>>16)&255),
		paramsArray[22],
		ab.uaCode[24],
		int((endTime>>8)&255),
		int(endTime&255),
		int((startTime>>24)&255),
		int((startTime>>16)&255),
		int((startTime>>8)&255),
		int(startTime&255),
		methodArray[21],
		methodArray[22],
		int(endTime/256/256/256/256)>>0,
		int(startTime/256/256/256/256)>>0,
		ab.browserLen,
	)
}

func (ab *ABogus) regToArray(a []uint32) []byte {
	o := make([]byte, 32)
	for i := 0; i < 8; i++ {
		c := a[i]
		o[4*i+3] = byte(c & 255)
		c >>= 8
		o[4*i+2] = byte(c & 255)
		c >>= 8
		o[4*i+1] = byte(c & 255)
		c >>= 8
		o[4*i] = byte(c & 255)
	}
	return o
}

func (ab *ABogus) compress(a []byte) {
	f := ab.generateF(a)
	i := make([]uint32, len(ab.reg))
	copy(i, ab.reg)

	for o := 0; o < 64; o++ {
		c := ab.de(i[0], 12) + i[4] + ab.de(ab.pe(o), o)
		c &= 0xFFFFFFFF
		c = ab.de(c, 7)
		s := (c ^ ab.de(i[0], 12)) & 0xFFFFFFFF

		u := ab.he(o, i[0], i[1], i[2])
		u = (u + i[3] + s + uint32(f[o+68])) & 0xFFFFFFFF

		b := ab.ve(o, i[4], i[5], i[6])
		b = (b + i[7] + c + uint32(f[o])) & 0xFFFFFFFF

		i[3] = i[2]
		i[2] = ab.de(i[1], 9)
		i[1] = i[0]
		i[0] = u

		i[7] = i[6]
		i[6] = ab.de(i[5], 19)
		i[5] = i[4]
		i[4] = (b ^ ab.de(b, 9) ^ ab.de(b, 17)) & 0xFFFFFFFF
	}

	for l := 0; l < 8; l++ {
		ab.reg[l] = (ab.reg[l] ^ i[l]) & 0xFFFFFFFF
	}
}

func (ab *ABogus) generateF(e []byte) []uint32 {
	r := make([]uint32, 132)

	for t := 0; t < 16; t++ {
		r[t] = (uint32(e[4*t]) << 24) |
			(uint32(e[4*t+1]) << 16) |
			(uint32(e[4*t+2]) << 8) |
			uint32(e[4*t+3])
		r[t] &= 0xFFFFFFFF
	}

	for n := 16; n < 68; n++ {
		a := r[n-16] ^ r[n-9] ^ ab.de(r[n-3], 15)
		a = a ^ ab.de(a, 15) ^ ab.de(a, 23)
		r[n] = (a ^ ab.de(r[n-13], 7) ^ r[n-6]) & 0xFFFFFFFF
	}

	for n := 68; n < 132; n++ {
		r[n] = (r[n-68] ^ r[n-64]) & 0xFFFFFFFF
	}

	return r
}

func (ab *ABogus) padArray(arr []byte, length int) []byte {
	for len(arr) < length {
		arr = append(arr, 0)
	}
	return arr
}

func (ab *ABogus) fill(length int) {
	size := 8 * ab.size
	ab.chunk = append(ab.chunk, 128)
	ab.chunk = ab.padArray(ab.chunk, length)

	sizeBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(sizeBytes, uint32(size))
	for i := 0; i < 4; i++ {
		ab.chunk = append(ab.chunk, sizeBytes[i])
	}
}

func (ab *ABogus) list4(a, b, c, d, e, f, g, h, i, j, k, m, n, o, p, q, r int) []int {
	return []int{
		44, a, 0, 0, 0, 0, 24, b, n, 0, c, d, 0, 0, 0, 1, 0, 239, e, o, f, g, 0, 0, 0, 0,
		h, 0, 0, 14, i, j, 0, k, m, 3, p, 1, q, 1, r, 0, 0, 0,
	}
}

func (ab *ABogus) endCheckNum(a []int) int {
	r := 0
	for _, i := range a {
		r ^= i
	}
	return r
}

func (ab *ABogus) decodeString(urlString string) string {
	return ab.filter.ReplaceAllStringFunc(urlString, func(match string) string {
		hex := match[1:]
		val, _ := strconv.ParseInt(hex, 16, 32)
		return string(rune(val))
	})
}

func (ab *ABogus) de(e uint32, r int) uint32 {
	r %= 32
	return (e<<uint(r))&0xFFFFFFFF | (e >> uint(32-r))
}

func (ab *ABogus) pe(e int) uint32 {
	if 0 <= e && e < 16 {
		return 2043430169
	} else if 16 <= e && e < 64 {
		return 2055708042
	}
	panic("invalid e value")
}

func (ab *ABogus) he(e int, r, t, n uint32) uint32 {
	if 0 <= e && e < 16 {
		return (r ^ t ^ n) & 0xFFFFFFFF
	} else if 16 <= e && e < 64 {
		return (r&t | r&n | t&n) & 0xFFFFFFFF
	}
	panic("invalid e value")
}

func (ab *ABogus) ve(e int, r, t, n uint32) uint32 {
	if 0 <= e && e < 16 {
		return (r ^ t ^ n) & 0xFFFFFFFF
	} else if 16 <= e && e < 64 {
		return (r&t | (^r)&n) & 0xFFFFFFFF
	}
	panic("invalid e value")
}

func (ab *ABogus) convertToCharCode(a string) []int {
	d := make([]int, len(a))
	for i, c := range a {
		d[i] = int(c)
	}
	return d
}

func (ab *ABogus) splitArray(arr []byte, chunkSize int) [][]byte {
	var result [][]byte
	for i := 0; i < len(arr); i += chunkSize {
		end := i + chunkSize
		if end > len(arr) {
			end = len(arr)
		}
		result = append(result, arr[i:end])
	}
	return result
}

func (ab *ABogus) charCodeAt(s string) []int {
	result := make([]int, utf8.RuneCountInString(s))
	i := 0
	for _, r := range s {
		result[i] = int(r)
		i++
	}
	return result
}

func (ab *ABogus) write(e interface{}) {
	switch v := e.(type) {
	case string:
		decoded := ab.decodeString(v)
		ab.chunk = []byte(decoded)
		ab.size = len(ab.chunk)
	case []byte:
		if len(v) <= 64 {
			ab.chunk = v
		} else {
			chunks := ab.splitArray(v, 64)
			for _, chunk := range chunks[:len(chunks)-1] {
				ab.compress(chunk)
			}
			ab.chunk = chunks[len(chunks)-1]
		}
		ab.size = len(v)
	case []int:
		bytes := make([]byte, len(v))
		for i, val := range v {
			bytes[i] = byte(val)
		}
		ab.write(bytes)
	default:
		panic("unsupported type")
	}
}

func (ab *ABogus) reset() {
	ab.chunk = nil
	ab.size = 0
	ab.reg = []uint32{
		1937774191,
		1226093241,
		388252375,
		3666478592,
		2842636476,
		372324522,
		3817729613,
		2969243214,
	}
}

func (ab *ABogus) sum(e interface{}, length int) []byte {
	ab.reset()
	ab.write(e)
	ab.fill(length)
	ab.compress(ab.chunk)
	return ab.regToArray(ab.reg)
}

func (ab *ABogus) generateResultUnit(n int, s string) string {
	r := ""
	jValues := []int{18, 12, 6, 0}
	kValues := []int{0xFC0000, 0x03F000, 0x0FC0, 0x3F}

	for idx, j := range jValues {
		k := kValues[idx]
		r += string(ab.str[s][(n&k)>>j])
	}
	return r
}

func (ab *ABogus) generateResultEnd(s string, e string) string {
	b := int(s[120]) << 16
	return string(ab.str[e][(b&0xFC0000)>>18]) +
		string(ab.str[e][(b&0x03F000)>>12]) + "=="
}

func (ab *ABogus) generateResult(s string, e string) string {
	var r strings.Builder

	s_rune := []rune(s)
	for i := 0; i < len(s_rune); i += 3 {
		var n int
		if i+2 < len(s_rune) {
			n = (int(s_rune[i]) << 16) | (int(s_rune[i+1]) << 8) | int(s_rune[i+2])
		} else if i+1 < len(s_rune) {
			n = (int(s_rune[i]) << 16) | (int(s_rune[i+1]) << 8)
		} else {
			n = int(s_rune[i]) << 16
		}

		jValues := []int{18, 12, 6, 0}
		kValues := []int{0xFC0000, 0x03F000, 0x0FC0, 0x3F}

		for idx, j := range jValues {
			k := kValues[idx]
			if j == 6 && i+1 >= len(s_rune) {
				break
			}
			if j == 0 && i+2 >= len(s_rune) {
				break
			}
			r.WriteByte(ab.str[e][(n&k)>>j])
		}
	}

	padding := (4 - r.Len()%4) % 4
	r.WriteString(strings.Repeat("=", padding))

	return r.String()
}

func (ab *ABogus) generateArgsCode() []int {
	a := make([]int, 0, 11)
	for j := 24; j >= 0; j -= 8 {
		a = append(a, ab.arguments[0]>>j)
	}
	a = append(a, ab.arguments[1]/256)
	a = append(a, ab.arguments[1]%256)
	a = append(a, ab.arguments[1]>>24)
	a = append(a, ab.arguments[1]>>16)
	for j := 24; j >= 0; j -= 8 {
		a = append(a, ab.arguments[2]>>j)
	}

	result := make([]int, len(a))
	for i, val := range a {
		result[i] = val & 255
	}
	return result
}

func (ab *ABogus) generateMethodCode(method string) []int {
	return ab.sm3ToArray(ab.sm3ToArray(method + ab.endString))
}

func (ab *ABogus) generateParamsCode(params string) []int {
	return ab.sm3ToArray(ab.sm3ToArray(params + ab.endString))
}

func (ab *ABogus) sm3ToArray(data interface{}) []int {
	var b []byte
	switch v := data.(type) {
	case string:
		b = []byte(v)
	case []int:
		b = make([]byte, len(v))
		for i, val := range v {
			b[i] = byte(val)
		}
	default:
		panic("unsupported type")
	}

	hash := sm3.Sm3Sum(b)
	result := make([]int, len(hash))
	for i, val := range hash {
		result[i] = int(val)
	}
	return result
}

func (ab *ABogus) generateBrowserInfo(platform string) string {
	rand1.Seed(time.Now().UnixNano())
	innerWidth := rand1.Intn(1920-1280+1) + 1280
	innerHeight := rand1.Intn(1080-720+1) + 720
	outerWidth := rand1.Intn(1920-innerWidth+1) + innerWidth
	outerHeight := rand1.Intn(1080-innerHeight+1) + innerHeight
	screenX := 0
	screenY := []int{0, 30}[rand1.Intn(2)]

	valueList := []int{
		innerWidth,
		innerHeight,
		outerWidth,
		outerHeight,
		screenX,
		screenY,
		0,
		0,
		outerWidth,
		outerHeight,
		outerWidth,
		outerHeight,
		innerWidth,
		innerHeight,
		24,
		24,
	}

	// Convert platform to char codes and add to valueList
	for _, r := range platform {
		valueList = append(valueList, int(r))
	}

	// Convert int values to strings
	strValues := make([]string, len(valueList))
	for i, v := range valueList {
		strValues[i] = strconv.Itoa(v)
	}

	return strings.Join(strValues, "|")
}

func (ab *ABogus) glen(s string) int {
	return utf8.RuneCountInString(s)
}

func (ab *ABogus) rc4_encrypt(plaintext, key string) string {
	// fmt.Println("plan text", plaintext)
	s := make([]int, 256)
	for i := 0; i < 256; i++ {
		s[i] = i
	}

	j := 0
	keyRunes := []rune(key)
	for i := 0; i < 256; i++ {
		j = (j + s[i] + int(keyRunes[i%len(keyRunes)])) % 256
		s[i], s[j] = s[j], s[i]
	}

	i := 0
	j = 0
	plaintextRunes := []rune(plaintext)
	cipher := make([]rune, len(plaintextRunes))

	for k := 0; k < len(plaintextRunes); k++ {
		i = (i + 1) % 256
		j = (j + s[i]) % 256
		s[i], s[j] = s[j], s[i]
		t := (s[i] + s[j]) % 256
		// text := fmt.Sprintf("%d %d %d %d / %s / %d", i, j, t, s[t], string(plaintextRunes[k]), int(plaintextRunes[k]))
		// fmt.Println(text)
		// cipher[k] = rune(s[t] ^ int(plaintextRunes[k]))
		cipher[k] = rune(s[t] ^ int(plaintextRunes[k]))
	}
	// fmt.Println("before return cipher")
	// fmt.Println(cipher)
	vvv := make([]string, len(cipher))
	for _, c := range cipher {
		v := fmt.Sprintf("%q", c)
		vvv = append(vvv, v)
	}
	result := string(cipher)
	// fmt.Println(result)
	return result
	// return strings.Join(vvv, "")
}

// func (ab *ABogus) rc4_encrypt(plaintext, key string) string {
// 	// fmt.Println("before rc4Encrypt", plaintext)
// 	s := make([]int, 256)
// 	for i := 0; i < 256; i++ {
// 		s[i] = i
// 	}
// 	j := 0
// 	for i := 0; i < 256; i++ {
// 		vv := key[i%len(key)]
// 		// fmt.Println(i, vv, int(vv))
// 		j = (j + s[i] + int(vv)) % 256
// 		s[i], s[j] = s[j], s[i]
// 	}

// 	i := 0
// 	j = 0
// 	cipher := make([]string, len(plaintext))

// 	fmt.Println("before for")
// 	fmt.Println(len(plaintext))

// 	for k := 0; k < len(plaintext); k++ {
// 		i = (i + 1) % 256
// 		j = (j + s[i]) % 256
// 		s[i], s[j] = s[j], s[i]
// 		t := (s[i] + s[j]) % 256
// 		vv := s[t] ^ int(plaintext[k])
// 		// text := fmt.Sprintf("%d %d %d %d / %s / %d / %d", i, j, t, s[t], string(plaintext[k]), int(plaintext[k]), vv)
// 		// fmt.Println(text)
// 		cipher[k] = fmt.Sprintf("%c", vv)
// 	}
// 	// fmt.Println()
// 	// fmt.Println("before string cipher")
// 	// fmt.Println(cipher)
// 	return strings.Join(cipher, "")
// }

func (ab *ABogus) GetValue(urlParams interface{}, orders []string, method string, startTime, endTime int64, randomNum1, randomNum2, randomNum3 *int) string {
	var paramsStr string
	switch v := urlParams.(type) {
	case string:
		paramsStr = v
	case map[string]string:
		var builder strings.Builder
		first := true
		// values := url.Values{}
		for _, key := range orders {
			if value, exists := v[key]; exists {
				if !first {
					builder.WriteByte('&')
				}
				first = false
				// if value != "" { // 跳过空值
				// 	// parts = append(parts,
				// 	// 	url.QueryEscape(key)+"="+url.QueryEscape(value))
				// }
				builder.WriteString(url.QueryEscape(key))
				builder.WriteByte('=')
				builder.WriteString(url.QueryEscape(value))
			}
		}
		// for key, val := range v {
		// 	values.Add(key, val)
		// }
		// paramsStr = values.Encode()
		paramsStr = builder.String()
	default:
		panic("unsupported urlParams type")
	}

	string1 := ab.generateString1(randomNum1, randomNum2, randomNum3)
	string2 := ab.generateString2(paramsStr, method, startTime, endTime)

	v := string1 + string2
	// fmt.Println("string_1")
	// fmt.Println(string1)
	// fmt.Println("string_2")
	// fmt.Println(string2)
	// fmt.Println("v")
	// fmt.Println(v)
	rrr := ab.generateResult(v, "s4")
	// fmt.Println(rrr)
	return url.QueryEscape(rrr)
}
