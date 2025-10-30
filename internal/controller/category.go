package controller

import (
	"fmt"

	"gorm.io/gorm"

	"devboard/models"
)

type CategoryController struct {
	db *gorm.DB
}

func NewCategoryController(db *gorm.DB) *CategoryController {
	return &CategoryController{
		db: db,
	}
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

type CategoryCreateBody struct {
	Label         string               `json:"label"`
	Type          string               `json:"type"`
	Description   string               `json:"description"`
	ParentId      *string              `json:"parent_id"`
	SubCategories []CategoryCreateBody `json:"children"`
}

func (s *CategoryController) CreateCategory(body CategoryCreateBody) (*models.CategoryNode, error) {
	var parentLevel int
	if body.ParentId != nil {
		// 检查父节点是否存在
		var parent models.CategoryNode
		if err := s.db.First(&parent, *body.ParentId).Error; err != nil {
			return nil, fmt.Errorf("父节点不存在: %v", err)
		}
		parentLevel = parent.Level
	}
	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 创建主类目
	main_category := models.CategoryNode{
		Label: body.Label,
		// NodeType:    body.NodeType,
		Description: body.Description,
		Level:       parentLevel + 1,
		IsActive:    true,
	}

	if err := tx.Create(&main_category).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建主类目失败: %v", err)
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
		return nil, fmt.Errorf("提交事务失败: %v", err)
	}

	// 重新查询以获取完整的关联数据
	var result models.CategoryNode
	if err := s.db.Preload("Children").First(&result, main_category.Id).Error; err != nil {
		return nil, fmt.Errorf("查询创建结果失败: %v", err)
	}

	return &result, nil
}

func (s *CategoryController) FetchCategoryTree() ([]models.CategoryNode, error) {
	var roots []models.CategoryNode
	err := s.db.Where("parent_id IS NULL").Preload("Children", recursivePreload).Find(&roots).Error
	if err != nil {
		return nil, fmt.Errorf("获取分类树失败: %v", err)
	}
	return roots, nil
}

func recursivePreload(db *gorm.DB) *gorm.DB {
	return db.Preload("Children", recursivePreload)
}

func (s *CategoryController) PreloadAll() func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Preload("Children", s.PreloadAll())
	}
}

type CategoryTree struct {
	models.CategoryNode
	Parents []CategoryTree `json:"parents"`
}

func (s *CategoryController) GetCategoryTreeOptimized() ([]CategoryTree, error) {
	// 获取所有叶子节点
	var leafNodes []models.CategoryNode
	s.db.Where("NOT EXISTS (SELECT 1 FROM category_hierarchy WHERE category_hierarchy.parent_id = category_node.id)").
		Find(&leafNodes)

	var results []CategoryTree

	for _, leaf := range leafNodes {
		tree := CategoryTree{CategoryNode: leaf}
		// 递归获取父节点
		var buildTree func(node *CategoryTree) error
		buildTree = func(node *CategoryTree) error {
			var parents []models.CategoryNode
			err := s.db.Table("category_node").
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
			return nil, err
		}
		results = append(results, tree)
	}
	return results, nil
}

func (s *CategoryController) GetCategoryTreeOptimized2() ([]models.CategoryNode, error) {
	var all_nodes []models.CategoryNode
	if err := s.db.Find(&all_nodes).Error; err != nil {
		return nil, err
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
	return trees, nil
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
