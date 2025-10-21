package service

import (
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"

	"devboard/internal/biz"
	"devboard/models"
)

type CategoryService struct {
	App *application.App
	Biz *biz.BizApp
}

func GetCategoryTreeOptimized(db *gorm.DB) ([]models.CategoryNode, error) {
	var allNodes []models.CategoryNode
	if err := db.Preload("Children").Preload("Parents").Find(&allNodes).Error; err != nil {
		return nil, err
	}

	nodeMap := make(map[string]*models.CategoryNode)
	for i := range allNodes {
		nodeMap[allNodes[i].Id] = &allNodes[i]
	}

	var roots []*models.CategoryNode
	for _, node := range nodeMap {
		if len(node.Parents) == 0 {
			roots = append(roots, node)
		}
	}

	var trees []models.CategoryNode
	visited := make(map[string]bool)
	nodeCache := make(map[string]*models.CategoryNode) // 缓存已构建的子树

	for _, root := range roots {
		if visited[root.Id] {
			continue
		}

		tree := buildTreeOptimized(root, nodeMap, visited, nodeCache, 0)
		trees = append(trees, *tree)
	}

	return trees, nil
}

// func buildTreeOptimized(node *models.CategoryNode, nodeMap map[string]*models.CategoryNode, visited map[string]bool, nodeCache map[string]*models.CategoryNode, depth int) *models.CategoryNode {
// 	if depth > 100 {
// 		return node
// 	}

// 	if cached, exists := nodeCache[node.Id]; exists {
// 		return cached
// 	}

// 	visited[node.Id] = true

// 	newNode := *node
// 	newNode.Children = nil

// 	for _, child := range node.Children {
// 		if visited[child.Id] {
// 			continue
// 		}

// 		childNode := nodeMap[child.Id]
// 		if childNode != nil {
// 			childTree := buildTreeOptimized(childNode, nodeMap, visited, nodeCache, depth+1)
// 			newNode.Children = append(newNode.Children, *childTree)
// 		}
// 	}

// 	nodeCache[node.Id] = &newNode
// 	return &newNode
// }

type CreateCategoryBody struct {
	Label         string               `json:"label"`
	Type          string               `json:"type"`
	Description   string               `json:"description"`
	ParentId      *string              `json:"parent_id"`
	SubCategories []CreateCategoryBody `json:"children"`
}

func (s *CategoryService) CreateCategory(body CreateCategoryBody) *Result {
	var parentLevel int
	if body.ParentId != nil {
		// 检查父节点是否存在
		var parent models.CategoryNode
		if err := s.Biz.DB.First(&parent, *body.ParentId).Error; err != nil {
			return Error(fmt.Errorf("父节点不存在: %v", err))
		}
		parentLevel = parent.Level
	}
	// 开始事务
	tx := s.Biz.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 创建主类目
	mainCategory := models.CategoryNode{
		Label: body.Label,
		// NodeType:    body.NodeType,
		Description: body.Description,
		Level:       parentLevel + 1,
		IsActive:    true,
	}

	if err := tx.Create(&mainCategory).Error; err != nil {
		tx.Rollback()
		return Error(fmt.Errorf("创建主类目失败: %v", err))
	}

	// 如果有子类目，递归创建
	// if len(body.SubCategories) > 0 {
	// 	if err := createSubCategories(tx, mainCategory.Id, body.SubCategories, mainCategory.Level+1); err != nil {
	// 		tx.Rollback()
	// 		return Error(err)
	// 	}
	// }

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return Error(fmt.Errorf("提交事务失败: %v", err))
	}

	// 重新查询以获取完整的关联数据
	var result models.CategoryNode
	if err := s.Biz.DB.Preload("Children").First(&result, mainCategory.Id).Error; err != nil {
		return Error(fmt.Errorf("查询创建结果失败: %v", err))
	}

	return Ok(&result)
}

func (s *CategoryService) FetchCategoryTree() *Result {
	var roots []models.CategoryNode
	err := s.Biz.DB.Where("parent_id IS NULL").Preload("Children", recursivePreload).Find(&roots).Error
	if err != nil {
		return Error(fmt.Errorf("获取分类树失败: %v", err))
	}
	return Ok(roots)
}

func recursivePreload(db *gorm.DB) *gorm.DB {
	return db.Preload("Children", recursivePreload)
}

func (s *CategoryService) PreloadAll() func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Preload("Children", s.PreloadAll())
	}
}

type CategoryTree struct {
	models.CategoryNode
	Parents []CategoryTree `json:"parents"`
}

func (s *CategoryService) GetCategoryTreeOptimized() *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}

	// 获取所有叶子节点
	var leafNodes []models.CategoryNode
	s.Biz.DB.Where("NOT EXISTS (SELECT 1 FROM category_hierarchy WHERE category_hierarchy.parent_id = category_node.id)").
		Find(&leafNodes)

	var results []CategoryTree

	for _, leaf := range leafNodes {
		tree := CategoryTree{CategoryNode: leaf}
		// 递归获取父节点
		var buildTree func(node *CategoryTree) error
		buildTree = func(node *CategoryTree) error {
			var parents []models.CategoryNode
			err := s.Biz.DB.Table("category_node").
				Joins("JOIN category_hierarchy ON category_node.id = category_hierarchy.parent_id").
				Where("category_hierarchy.child_id = ?", node.Id).
				Find(&parents).Error
			if err != nil {
				return err
			}

			for _, parent := range parents {
				parentTree := CategoryTree{CategoryNode: parent}
				if err := buildTree(&parentTree); err != nil {
					return err
				}
				node.Parents = append(node.Parents, parentTree)
			}
			return nil
		}

		if err := buildTree(&tree); err != nil {
			return Error(err)
		}
		results = append(results, tree)
	}
	return Ok(results)
}

func (s *CategoryService) GetCategoryTreeOptimized2() *Result {
	if err := s.Biz.Ensure(); err != nil {
		return Error(err)
	}
	var all_nodes []models.CategoryNode
	if err := s.Biz.DB.Find(&all_nodes).Error; err != nil {
		return Error(err)
	}
	node_map := make(map[string]*models.CategoryNode)
	for i := range all_nodes {
		node_map[all_nodes[i].Id] = &all_nodes[i]
	}
	var roots []*models.CategoryNode
	for _, node := range node_map {
		if len(node.Parents) == 0 {
			roots = append(roots, node)
		}
	}
	var trees []models.CategoryNode
	visited := make(map[string]bool)
	node_cache := make(map[string]*models.CategoryNode) // 缓存已构建的子树

	for _, root := range roots {
		if visited[root.Id] {
			continue
		}
		tree := buildTreeOptimized(root, node_map, visited, node_cache, 0)
		trees = append(trees, *tree)
	}
	return Ok(trees)
}

func buildTreeOptimized(node *models.CategoryNode, nodeMap map[string]*models.CategoryNode, visited map[string]bool, nodeCache map[string]*models.CategoryNode, depth int) *models.CategoryNode {
	if depth > 100 {
		return node
	}

	if cached, exists := nodeCache[node.Id]; exists {
		return cached
	}

	visited[node.Id] = true

	newNode := *node
	newNode.Children = nil

	for _, child := range node.Children {
		if visited[child.Id] {
			continue
		}

		childNode := nodeMap[child.Id]
		if childNode != nil {
			childTree := buildTreeOptimized(childNode, nodeMap, visited, nodeCache, depth+1)
			newNode.Children = append(newNode.Children, *childTree)
		}
	}

	nodeCache[node.Id] = &newNode
	return &newNode
}
