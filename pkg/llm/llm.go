package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

// ChatRequest 定义了聊天请求的结构
type LLMChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type LLMChatRequest struct {
	APIProxyAddress string           `json:"apiProxyAddress"`
	APIKey          string           `json:"apiKey"`
	Messages        []LLMChatMessage `json:"messages"`
	Model           string           `json:"model"`
	Extra           struct {
		Stream      bool    `json:"stream"`
		Temperature float64 `json:"temperature"`
	} `json:"extra"`
}

// LLMChatResponse 定义了聊天响应的结构
type LLMChatResponse struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

//	func main() {
//		http.HandleFunc("/api/v1/chat", enableCORS(LLMChatHandler))
//		port := "127.0.0.1:8080"
//		log.Printf("Server starting on port %s", port)
//		if err := http.ListenAndServe(port, nil); err != nil {
//			log.Fatalf("Failed to start server: %v", err)
//		}
//	}
func LLMChatHandler(w http.ResponseWriter, r *http.Request) {
	// 只允许 POST 请求
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 读取请求体
	body, err := io.ReadAll(r.Body)
	if err != nil {
		sendErrorResponse(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// 解析 JSON 请求
	var chat_req LLMChatRequest
	if err := json.Unmarshal(body, &chat_req); err != nil {
		sendErrorResponse(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// 验证必要的字段
	if chat_req.APIProxyAddress == "" {
		sendErrorResponse(w, "Missing required fields: apiProxyAddress", http.StatusBadRequest)
		return
	}

	// 调用 LLM API
	resp, err := RequestLLMProvider(chat_req)
	if err != nil {
		sendErrorResponse(w, fmt.Sprintf("Error calling LLM API: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// 读取响应
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		sendErrorResponse(w, fmt.Sprintf("Error reading API response: %v", err), http.StatusInternalServerError)
		return
	}

	// 检查响应状态码
	if resp.StatusCode != http.StatusOK {
		sendErrorResponse(w, fmt.Sprintf("LLM API error: %s", string(respBody)), resp.StatusCode)
		return
	}

	// 设置响应头
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// 直接将 LLM API 的响应转发给客户端
	response := LLMChatResponse{
		Code: 0,
		Msg:  "success",
		Data: json.RawMessage(respBody),
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding response: %v", err)
	}
}

// 发送错误响应的辅助函数
func sendErrorResponse(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := LLMChatResponse{
		Code: 0,
		Msg:  message,
		Data: nil,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding error response: %v", err)
	}
}

// RequestLLMProvider 处理与 LLM API 的通信
func RequestLLMProvider(chat_req LLMChatRequest) (*http.Response, error) {
	// 构建请求体
	request_body := map[string]interface{}{
		"messages":    chat_req.Messages,
		"model":       chat_req.Model,
		"stream":      chat_req.Extra.Stream,
		"temperature": chat_req.Extra.Temperature,
	}

	json_body, err := json.Marshal(request_body)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request body: %v", err)
	}

	// 创建请求
	req, err := http.NewRequest("POST", chat_req.APIProxyAddress, bytes.NewBuffer(json_body))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", chat_req.APIKey))

	// 发送请求
	client := &http.Client{}
	return client.Do(req)
}
