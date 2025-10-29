package service

type Result struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

func Error(err error) *Result {
	resp := Result{
		Code: 100,
		Msg:  err.Error(),
		Data: nil,
	}
	return &resp
}
func Ok(data interface{}) *Result {
	resp := Result{
		Code: 0,
		Msg:  "",
		Data: data,
	}
	return &resp
}
