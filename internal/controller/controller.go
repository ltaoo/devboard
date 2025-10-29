package controller

type ListResp[T any] struct {
	List       []T    `json:"list"`
	Page       int    `json:"page"`
	PageSize   int    `json:"page_size"`
	HasMore    bool   `json:"has_more"`
	NextMarker string `json:"next_marker"`
}

type Result[T any] struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data T      `json:"data"`
}

func Error[T any](err error) *Result[*T] {
	resp := Result[*T]{
		Code: 100,
		Msg:  err.Error(),
		Data: nil,
	}
	// v, err := json.Marshal(resp)
	// if err != nil {
	// 	return fmt.Sprintf(`{"code":500,"msg":"%s","data":null}`, err.Error())
	// }
	return &resp
}
func Ok[T any](data T) *Result[T] {
	resp := Result[T]{
		Code: 0,
		Msg:  "",
		Data: data,
	}
	// v, err := json.Marshal(resp)
	// if err != nil {
	// 	return fmt.Sprintf(`{"code":500,"msg":"%s","data":null}`, err.Error())
	// }
	// return string(v)
	return &resp
}
