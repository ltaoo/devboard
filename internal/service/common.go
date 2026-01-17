package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/net/html"

	"devboard/internal/biz"
	"devboard/internal/controller"
	"devboard/models"
	"devboard/pkg/lodash"
)

type CommonService struct {
	App *application.App
	Biz *biz.BizApp
}

func NewCommonService(app *application.App, biz *biz.BizApp) *CommonService {
	return &CommonService{App: app, Biz: biz}
}

func (s *CommonService) OpenWindow(body biz.OpenWindowBody) *Result {
	_, err := s.Biz.OpenWindow(body)
	if err != nil {
		return Error(err)
	}
	return Ok(map[string]interface{}{
		"ok": true,
	})
}

func (s *CommonService) ShowError(body biz.ErrorBody) *Result {
	s.Biz.ShowError(body)
	return Ok(map[string]interface{}{})
}

type ShortcutRegisterBody struct {
	Shortcut string `json:"shortcut"`
	Command  string `json:"command"`
}

func (s *CommonService) RegisterShortcut(body ShortcutRegisterBody) *Result {
	if body.Shortcut == "" {
		return Error(fmt.Errorf("Missing the shortcut"))
	}
	if err := s.Biz.RegisterShortcutWithCommand(body.Shortcut, body.Command); err != nil {
		return Error(err)
	}
	return Ok(nil)
}

func (s *CommonService) UnregisterShortcut(body ShortcutRegisterBody) *Result {
	if body.Shortcut == "" {
		return Error(fmt.Errorf("Missing the shortcut"))
	}
	if err := s.Biz.UnregisterShortcut(body.Shortcut); err != nil {
		return Error(err)
	}
	return Ok(nil)
}

func (s *CommonService) FetchAppList(body controller.AppListBody) *Result {
	list, err := s.Biz.ControllerMap.App.FetchAppList(body)
	if err != nil {
		return Error(err)
	}
	result := lodash.Map(list, func(v *models.App, idx int) map[string]interface{} {
		return map[string]interface{}{
			"id":       v.Id,
			"name":     v.Name,
			"logo_url": v.LogoURL,
		}
	})
	return Ok(controller.ListResp[map[string]interface{}]{
		List:       result,
		Page:       1,
		PageSize:   100,
		HasMore:    false,
		NextMarker: "",
	})
}

func (s *CommonService) FetchDeviceList(body controller.DeviceListBody) *Result {
	list, err := s.Biz.ControllerMap.Device.FetchDeviceList(body)
	if err != nil {
		return Error(err)
	}
	result := lodash.Map(list, func(v *models.Device, idx int) map[string]interface{} {
		return map[string]interface{}{
			"id":   v.Id,
			"name": v.Name,
		}
	})
	return Ok(controller.ListResp[map[string]interface{}]{
		List:       result,
		Page:       1,
		PageSize:   100,
		HasMore:    false,
		NextMarker: "",
	})
}

type FetchURLMetaBody struct {
	URL string `json:"url"`
}

type URLMeta struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	SiteName    string `json:"site_name"`
	Icon        string `json:"icon"`
	Image       string `json:"image"`
	URL         string `json:"url"`
}

func (s *CommonService) FetchURLMeta(body FetchURLMetaBody) *Result {
	if body.URL == "" {
		return Error(fmt.Errorf("Missing the url"))
	}
	parsed, err := url.Parse(body.URL)
	if err != nil {
		return Error(err)
	}
	if parsed.Scheme == "" {
		parsed.Scheme = "https"
	}
	if parsed.Host == "" {
		return Error(fmt.Errorf("Invalid url"))
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return Error(err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return Error(err)
	}
	defer resp.Body.Close()
	limited := io.LimitReader(resp.Body, 512*1024)
	buf, err := io.ReadAll(limited)
	if err != nil {
		return Error(err)
	}
	doc, err := html.Parse(bytes.NewReader(buf))
	if err != nil {
		return Error(err)
	}
	meta := extractURLMeta(doc, parsed)
	return Ok(meta)
}

func extractURLMeta(doc *html.Node, baseURL *url.URL) URLMeta {
	meta := URLMeta{
		URL: baseURL.String(),
	}
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch strings.ToLower(n.Data) {
			case "title":
				if meta.Title == "" && n.FirstChild != nil {
					meta.Title = strings.TrimSpace(n.FirstChild.Data)
				}
			case "meta":
				var name string
				var property string
				var content string
				for _, attr := range n.Attr {
					key := strings.ToLower(attr.Key)
					switch key {
					case "name":
						name = strings.ToLower(attr.Val)
					case "property":
						property = strings.ToLower(attr.Val)
					case "content":
						content = attr.Val
					}
				}
				if content == "" {
					break
				}
				switch {
				case property == "og:title" && meta.Title == "":
					meta.Title = strings.TrimSpace(content)
				case property == "og:description" && meta.Description == "":
					meta.Description = strings.TrimSpace(content)
				case property == "og:site_name" && meta.SiteName == "":
					meta.SiteName = strings.TrimSpace(content)
				case property == "og:image" && meta.Image == "":
					meta.Image = resolveURL(baseURL, content)
				case name == "description" && meta.Description == "":
					meta.Description = strings.TrimSpace(content)
				}
			case "link":
				var rel string
				var href string
				for _, attr := range n.Attr {
					key := strings.ToLower(attr.Key)
					switch key {
					case "rel":
						rel = strings.ToLower(attr.Val)
					case "href":
						href = attr.Val
					}
				}
				if meta.Icon != "" || href == "" {
					break
				}
				if strings.Contains(rel, "icon") {
					meta.Icon = resolveURL(baseURL, href)
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	if meta.Title == "" {
		meta.Title = baseURL.Host
	}
	if meta.Description == "" {
		meta.Description = baseURL.String()
	}
	if meta.SiteName == "" {
		meta.SiteName = baseURL.Hostname()
	}
	if meta.Icon == "" {
		meta.Icon = resolveURL(baseURL, "/favicon.ico")
	}
	return meta
}

func resolveURL(baseURL *url.URL, ref string) string {
	u, err := baseURL.Parse(ref)
	if err != nil {
		return ref
	}
	return u.String()
}
