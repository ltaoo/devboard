package douyinweb

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"devboard/pkg/lodash"
)

var paramOrder = []string{
	"device_platform",
	"aid",
	"channel",
	"pc_client_type",
	"version_code",
	"version_name",
	"cookie_enabled",
	"screen_width",
	"screen_height",
	"browser_language",
	"browser_platform",
	"browser_name",
	"browser_version",
	"browser_online",
	"engine_name",
	"engine_version",
	"os_name",
	"os_version",
	"cpu_core_num",
	"device_memory",
	"platform",
	"downlink",
	"effective_type",
	"from_user_page",
	"locate_query",
	"need_time_list",
	"pc_libra_divert",
	"publish_video_strategy_type",
	"round_trip_time",
	"show_live_replay_strategy",
	"time_list_query",
	"whale_cut_token",
	"update_version_code",
	"msToken",
	"aweme_id",
	"a_bogus",
}

var defaultParams = map[string]string{
	"device_platform":             "webapp",
	"aid":                         "6383",
	"channel":                     "channel_pc_web",
	"pc_client_type":              "1",
	"version_code":                "290100",
	"version_name":                "29.1.0",
	"cookie_enabled":              "true",
	"screen_width":                "1920",
	"screen_height":               "1080",
	"browser_language":            "zh-CN",
	"browser_platform":            "Win32",
	"browser_name":                "Chrome",
	"browser_version":             "130.0.0.0",
	"browser_online":              "true",
	"engine_name":                 "Blink",
	"engine_version":              "130.0.0.0",
	"os_name":                     "Windows",
	"os_version":                  "10",
	"cpu_core_num":                "12",
	"device_memory":               "8",
	"platform":                    "PC",
	"downlink":                    "10",
	"effective_type":              "4g",
	"from_user_page":              "1",
	"locate_query":                "false",
	"need_time_list":              "1",
	"pc_libra_divert":             "Windows",
	"publish_video_strategy_type": "2",
	"round_trip_time":             "0",
	"show_live_replay_strategy":   "1",
	"time_list_query":             "0",
	"whale_cut_token":             "",
	"update_version_code":         "170400",
	"msToken":                     "",
}

func query_stringify(params map[string]string, orders []string) string {
	var builder strings.Builder
	first := true

	for _, key := range orders {
		if value, exists := params[key]; exists {
			if !first {
				builder.WriteByte('&')
			}
			first = false
			builder.WriteString(url.QueryEscape(key))
			builder.WriteByte('=')
			builder.WriteString(url.QueryEscape(value))
		}
	}

	return builder.String()
}

type DouyinWebClient struct {
	cookie string
}

func New(cookie string) *DouyinWebClient {
	return &DouyinWebClient{cookie: cookie}
}

func (c *DouyinWebClient) FetchVideoProfile(aweme_id string) (*DouyinWebVideoProfileResp, error) {
	params := defaultParams
	params["aweme_id"] = aweme_id
	params["msToken"] = ""
	ab := NewABogus("")
	aBogus := ab.GetValue(params, paramOrder, "GET", 0, 0, nil, nil, nil)
	headers := map[string]interface{}{
		"Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
		"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
		"Referer":         "https://www.douyin.com/",
		"Cookie":          c.cookie,
	}
	search := query_stringify(params, paramOrder) + "&a_bogus=" + aBogus
	u := "https://www.douyin.com/aweme/v1/web/aweme/detail/?" + search
	client := NewHttpClient("GET", u, map[string]string{}, headers)
	resp, err := client.Request()
	if err != nil {
		return nil, err
	}
	var result DouyinWebVideoProfileResp
	if err := resp.ToJSON(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
func (c *DouyinWebClient) ExtraVideoId(content string) (string, error) {
	if content == "" {
		return "", fmt.Errorf("Missing the content")
	}
	short_link_regex := regexp.MustCompile(`https://v\.douyin\.com/([a-zA-Z0-9_]{1,})/`)
	full_link_regex := regexp.MustCompile(`https://www.douyin.com/video/([0-9]{1,})/{0,1}`)
	if !lodash.StartWith(content, "http") {
		m := short_link_regex.FindAllString(content, -1)
		if len(m) != 0 {
			return c.ShortLinkToFullURL(m[0])
		}
		return "", fmt.Errorf("Not a valid URL")
	}
	matched := full_link_regex.FindStringSubmatch(content)
	if len(matched) != 0 {
		id := matched[1]
		if id == "" {
			return "", fmt.Errorf("Failed to extra id from full url")
		}
		return id, nil
	}
	matched2 := short_link_regex.FindStringSubmatch(content)
	if len(matched2) != 0 {
		id := matched2[1]
		if id == "" {
			return "", fmt.Errorf("Failed to extra id from full url")
		}
		return id, nil
	}
	return "", fmt.Errorf("Failed to extra id from full url")
}
func (c *DouyinWebClient) ShortLinkToFullURL(short_link string) (string, error) {
	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Head(short_link)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusFound {
		// fmt.Println("Redirect URL:", resp.Header.Get("Location"))
		rawURL := resp.Header.Get("Location")
		// 解析 URL
		parsedURL, err := url.Parse(rawURL)
		if err != nil {
			return "", err
		}
		path := parsedURL.Path
		// 使用正则表达式提取数字
		re := regexp.MustCompile(`/(\d+)/?$`)
		matches := re.FindStringSubmatch(path)
		if len(matches) > 1 {
			number := matches[1]
			return number, nil
		} else {
		}
		return "", errors.New("Not find matched number")
	}
	return "", errors.New("Can't find matched number")
}
