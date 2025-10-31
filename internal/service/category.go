package service

import (
	"github.com/wailsapp/wails/v3/pkg/application"

	"devboard/internal/biz"
	"devboard/internal/controller"
)

type CategoryService struct {
	App *application.App
	Biz *biz.BizApp
}

func NewCategoryService(app *application.App, biz *biz.BizApp) *CategoryService {
	return &CategoryService{
		App: app,
		Biz: biz,
	}
}

func (s *CategoryService) CreateCategory(body controller.CategoryCreateBody) *Result {
	r, err := s.Biz.ControllerMap.Category.CreateCategory(body)
	if err != nil {
		return Error(err)
	}
	return Ok(&r)
}

func (s *CategoryService) FetchCategoryTree() *Result {
	r, err := s.Biz.ControllerMap.Category.FetchCategoryTree()
	if err != nil {
		return Error(err)
	}
	return Ok(r)
}

type CategoryTreeResp struct {
	Id        string             `json:"id"`
	Label     string             `json:"label"`
	CreatedAt string             `json:"created_at"`
	Parents   []CategoryTreeResp `json:"parents"`
}

func category_nodes_process(r []controller.CategoryTree) []CategoryTreeResp {
	var nodes []CategoryTreeResp
	for _, n := range r {
		nodes = append(nodes, CategoryTreeResp{
			Id:        n.Id,
			Label:     n.Label,
			CreatedAt: n.CreatedAt,
			Parents:   category_nodes_process(n.Parents),
		})
	}
	return nodes
}

func (s *CategoryService) GetCategoryTreeOptimized() *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	r, err := s.Biz.ControllerMap.Category.GetCategoryTreeOptimized()
	if err != nil {
		return Error(err)
	}
	nodes := category_nodes_process(r)
	return Ok(nodes)
}

func (s *CategoryService) GetCategoryTreeOptimized2() *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	r, err := s.Biz.ControllerMap.Category.GetCategoryTreeOptimized2()
	if err != nil {
		return Error(err)
	}
	return Ok(r)
}
