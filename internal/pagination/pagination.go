package pagination

import (
	"fmt"
	"reflect"

	"gorm.io/gorm"
)

// PaginationBuilder is a utility for building paginated queries
type PaginationBuilder[T any] struct {
	query      *gorm.DB
	Limit      int
	page       int
	nextMarker string
	orderBy    string
}

// NewPaginationBuilder creates a new PaginationBuilder instance
func NewPaginationBuilder[T any](query *gorm.DB) *PaginationBuilder[T] {
	return &PaginationBuilder[T]{
		query:   query,
		Limit:   20,        // default limit
		orderBy: "id DESC", // default order
	}
}

// SetLimit sets the page size
func (pb *PaginationBuilder[T]) SetLimit(limit int) *PaginationBuilder[T] {
	if limit > 0 {
		pb.Limit = limit
	}
	return pb
}

// GetLimit returns the current limit
func (pb *PaginationBuilder[T]) GetLimit() int {
	return pb.Limit
}

// SetPage sets the page number
func (pb *PaginationBuilder[T]) SetPage(page int) *PaginationBuilder[T] {
	if page > 0 {
		pb.page = page
	}
	return pb
}

// SetNextMarker sets the cursor for cursor-based pagination
func (pb *PaginationBuilder[T]) SetNextMarker(next_marker string) *PaginationBuilder[T] {
	pb.nextMarker = next_marker
	return pb
}

// SetOrderBy sets the ordering field
func (pb *PaginationBuilder[T]) SetOrderBy(order_by string) *PaginationBuilder[T] {
	if order_by != "" {
		pb.orderBy = order_by
	}
	return pb
}

// Build builds the paginated query
func (pb *PaginationBuilder[T]) Build() *gorm.DB {
	query := pb.query

	// Apply cursor-based pagination if nextMarker is provided
	if pb.nextMarker != "" {
		query = query.Where("id < ?", pb.nextMarker)
	}

	// Apply offset-based pagination if page is provided
	if pb.page > 0 {
		query = query.Offset((pb.page - 1) * pb.Limit)
	}

	// Apply ordering and limit
	query = query.Order(pb.orderBy).Limit(pb.Limit + 1)

	return query
}

// ProcessResults processes the query results and returns pagination metadata
func (pb *PaginationBuilder[T]) ProcessResults(results []T) ([]T, bool, string) {
	has_more := false
	next_cursor := ""

	// Check if there are more results
	if len(results) > pb.Limit {
		has_more = true
		results = results[:pb.Limit] // Remove the extra item we fetched

		// Get the last item's ID as next cursor
		lastItem := reflect.ValueOf(results[pb.Limit-1])
		if idField := lastItem.FieldByName("Id"); idField.IsValid() {
			next_cursor = fmt.Sprintf("%v", idField.Interface())
		}
	}

	return results, has_more, next_cursor
}
