package service

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/internal/biz"
	"devboard/pkg/douyinweb"
)

type DouyinService struct {
	App *application.App
	Biz *biz.BizApp
}

type DownloadDouyinVideoBody struct {
	Content string `json:"content"`
}

func (s *DouyinService) DownloadDouyinVideo(body DownloadDouyinVideoBody) *Result {
	cookie := s.Biz.Perferences.Get("douyin.cookie", "").(string)
	if cookie == "" {
		return Error(fmt.Errorf("Missing the cookie"))
	}
	client := douyinweb.New(cookie)
	aweme_id, err := client.ExtraVideoId(body.Content)
	if err != nil {
		return Error(err)
	}
	r, err := client.FetchVideoProfile(aweme_id)
	if err != nil {
		return Error(err)
	}
	video := r.AwemeDetail.Video
	if len(video.BitRate) == 0 {
		return Error(fmt.Errorf("There's no source in video profile"))
	}
	var the_source *douyinweb.BitRate
	for _, b := range video.BitRate {
		if b.GearName == "normal_1080_0" {
			the_source = &b
		}
	}
	if the_source == nil {
		the_source = &video.BitRate[0]
	}
	source_url := the_source.PlayAddr.UrlList[0]
	if source_url == "" {
		return Error(fmt.Errorf("Can't find the source url"))
	}
	dialog := application.SaveFileDialog()
	dialog.CanCreateDirectories(true)
	dialog.SetFilename(aweme_id + "." + the_source.Format)
	h_client := &http.Client{
		Timeout: 30 * time.Second,
	}
	req, err := http.NewRequest("GET", source_url, nil)
	if err != nil {
		return Error(fmt.Errorf("failed to create request: %v", err))
	}
	// 添加常见的浏览器请求头
	req.Header = http.Header{
		"Accept-Language": {"zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2"},
		"User-Agent":      {"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"},
		"Referer":         {"https://www.douyin.com/"},
		"Cookie":          {cookie},
	}
	resp, err := h_client.Do(req)
	if err != nil {
		return Error(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Error(fmt.Errorf("bad status: %s", resp.Status))
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return Error(err)
	}
	if path, err := dialog.PromptForSingleSelection(); err == nil {
		if path == "" {
			return Ok(map[string]interface{}{
				"cancel": true,
			})
		}
		file, err := os.Create(path)
		if err != nil {
			return Error(err)
		}
		defer file.Close()
		_, err = file.Write(b)
		if err != nil {
			return Error(err)
		}
		return Ok(map[string]interface{}{
			"path": path,
		})
	}
	return Ok(map[string]interface{}{})
}

func Test() *Result {
	return Ok(nil)
}
