package douyinweb

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type HttpClient struct {
	req *http.Request
}
type HttpResponse struct {
	body []byte
}

func NewHttpClient(method string, u string, body any, headers any) *HttpClient {
	request_method := method
	request_url := u
	// request_body := body
	// request_headers := headers
	// request_method := "POST"
	// request_url := "/accounts/" + account_id + "/pages/projects/" + project_name + "/upload-token"
	// request_headers := map[string]string{
	// 	"Content-Type":  "application/json",
	// 	"Authorization": "Bearer " + CF_PAGES_UPLOAD_JWT,
	// }
	// request_body := map[string][]string{
	// 	"hashes": {account_id},
	// }
	values := url.Values{}
	switch tt := body.(type) {
	case map[string]interface{}:
		for k, v := range tt {
			switch t2 := v.(type) {
			case string:
				values.Add(k, t2)
			case []string:
				// values.Add(k, tt)
			default:
				// ...
			}
		}
	case map[string]string:
		for k, v := range tt {
			values.Add(k, v)
		}
	}
	_headers := make(map[string]string)
	switch tt := headers.(type) {
	case map[string]interface{}:
		for k, v := range tt {
			switch t2 := v.(type) {
			case string:
				_headers[k] = t2
			case []string:
				// values.Add(k, tt)
			default:
				// ...
			}
		}
	case map[string]string:
		for k, v := range tt {
			_headers[k] = v
		}
	}

	req, err := http.NewRequest(
		request_method,
		request_url,
		strings.NewReader(values.Encode()),
	)
	if err != nil {
		return nil
	}
	for key, value := range _headers {
		// fmt.Println("add header", key, value)
		req.Header.Set(key, value)
	}
	return &HttpClient{req}

}
func (c *HttpClient) Request() (*HttpResponse, error) {
	client := &http.Client{}
	resp, err := client.Do(c.req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	// 读取原始响应体
	resp_bytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return &HttpResponse{body: resp_bytes}, nil
}
func (c *HttpResponse) ToJSON(v any) error {
	if err := json.Unmarshal(c.body, &v); err != nil {
		return err
	}
	return nil
}
