package service

import (
	"fmt"

	"github.com/studio-b12/gowebdav"
)

type WebdavService struct {
	// Config *WebdavConfig
	// Client *http.Client
	Client *gowebdav.Client
}

type WebdavConfig struct {
	Endpoint string `json:"endpoint"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func New(cfg *WebdavConfig) *WebdavService {
	// client := &http.Client{
	// 	Transport: &http.Transport{
	// 		// 可根据需要配置Transport
	// 	},
	// }
	client := gowebdav.NewClient(cfg.Endpoint, cfg.Username, cfg.Password)
	return &WebdavService{
		// Config: cfg,
		Client: client,
	}
}

func (s *WebdavService) FetchFiles(path string) *Result {
	// url := s.Config.Endpoint + path
	// var body io.Reader
	// req, err := http.NewRequest(method, url, body)
	// if err != nil {
	// 	return Error(err)
	// }
	// req.SetBasicAuth(s.Config.Username, s.Config.Password)

	// req.Header.Add("Depth", "1")
	// resp, err := s.Client.Do(req)
	// if err != nil {
	// 	return Error(err)
	// }
	// defer resp.Body.Close()
	// return Ok(resp.Body)
	files, err := s.Client.ReadDir(path)
	if err != nil {
		return Error(err)
	}
	fmt.Printf("Files in %s:\n", path)
	for _, file := range files {
		fmt.Printf("- %s (size: %d, dir: %v)\n", file.Name(), file.Size(), file.IsDir())
	}
	return Ok(files)
}

func (s *WebdavService) UploadFile(file_path string, remote_file_path string) {

}
