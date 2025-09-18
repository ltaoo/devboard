package utils

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

func ThisIsMyHelperFunction() string {
	return "hello"
}

type User struct {
	Id int `json:"id"`
	// 其他字段...
}

func GetUser(c *gin.Context) *User {
	user, exists := c.Get("user")
	if !exists {
		return nil
	}
	claims, ok := user.(jwt.MapClaims)
	if !ok {
		return nil
	}
	user_id, ok := claims["id"].(float64)
	if !ok {
		return nil
	}
	return &User{Id: int(user_id)}
}

type RequestPayload struct {
	URL     string
	Method  string
	Payload []byte
	Headers map[string]string
}
type RequestResponse struct {
	Code int
	Msg  string
	Data interface{}
}

func Request(body RequestPayload, response any) error {
	url := body.URL
	method := body.Method
	payload := body.Payload
	headers := body.Headers

	client := &http.Client{}
	req, err := http.NewRequest(method, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	result, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return errors.New(fmt.Sprintf("received %v response status code, and message is %v", resp.StatusCode, string(result)))
	}
	var rr interface{}
	json.Unmarshal(result, rr)
	// fmt.Println("jsonresponse", rr)
	if err := json.Unmarshal(result, &response); err != nil {
		return err
	}
	return nil
}

func Request2(body RequestPayload) ([]byte, error) {
	url := body.URL
	method := body.Method
	payload := body.Payload
	headers := body.Headers

	client := &http.Client{}
	req, err := http.NewRequest(method, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	result, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, errors.New("received non-2xx response status")
	}
	// var response interface{}
	// if err := json.Unmarshal(result, &response); err != nil {
	// 	return nil, err
	// }
	return result, nil
}

type RequestPayload3 struct {
	URL     string
	Method  string
	Payload map[string]interface{}
	Headers map[string]string
}

func Request3(body RequestPayload3, response any) error {
	url1 := body.URL
	method := body.Method
	payload := body.Payload
	headers := body.Headers

	var req *http.Request

	if method == "GET" {
		u, err := url.Parse(url1)
		if err != nil {
			return err
		}
		params := url.Values{}
		for key, value := range payload {
			v, ok := value.(string)
			if ok {
				params.Add(key, v)
			}
			v2, ok2 := value.(int)
			if ok2 {
				params.Add(key, strconv.Itoa(v2))
			}
		}
		u.RawQuery = params.Encode()
		req, err = http.NewRequest("GET", u.String(), nil)
		if err != nil {
			return err
		}
	}
	if method == "POST" {
		payload, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		req, err = http.NewRequest("POST", url1, bytes.NewReader(payload))
		if err != nil {
			return err
		}
	}
	client := &http.Client{}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	result, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return errors.New(fmt.Sprintf("received %v response status code, and message is %v", resp.StatusCode, string(result)))
	}
	var rr interface{}
	json.Unmarshal(result, rr)
	// fmt.Println("jsonresponse", rr)
	if err := json.Unmarshal(result, &response); err != nil {
		return err
	}
	return nil
}
