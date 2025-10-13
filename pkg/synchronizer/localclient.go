package synchronizer

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	"gorm.io/gorm"
)

type LocalClient interface {
	FetchTableLastRecord() (map[string]interface{}, error)
	FetchUniqueDaysOfTable() []string
	FetchRecordsBetweenSpecialDayOfTable(day_str string) ([]map[string]interface{}, error)
	FetchRecordOrderByTimeAndBetweenStartAndEndOfTable(start int64, end int64) ([]map[string]interface{}, error)
	FetchRecordById(id string) ([]map[string]interface{}, error)
	SetRecords(v []map[string]interface{})
}

type DatabaseLocalClient struct {
	DB        *gorm.DB
	TableName string
}

func (c *DatabaseLocalClient) FetchTableLastRecord() (map[string]interface{}, error) {
	var records []map[string]interface{}
	if err := c.DB.Table(c.TableName).Order("last_operation_time DESC").Limit(1).Find(&records).Error; err != nil {
		return nil, fmt.Errorf("search latest record of table failed, because %v", err.Error())
	}
	if len(records) == 0 {
		return nil, fmt.Errorf("the table don't have any records, can't synchronize to remote server")
	}
	return records[0], nil
}
func (c *DatabaseLocalClient) FetchUniqueDaysOfTable() []string {
	var dates []string
	c.DB.Table(c.TableName).
		Select("strftime('%Y-%m-%d', created_at) as date").
		Group("date").
		Pluck("date", &dates)
	return dates
}
func (c *DatabaseLocalClient) FetchRecordsBetweenSpecialDayOfTable(day_str string) ([]map[string]interface{}, error) {
	var day_records []map[string]interface{}
	if err := c.DB.Table(c.TableName).Where("date(created_at) = ?", day_str).Order("last_operation_time DESC").Find(&day_records).Error; err != nil {
		return nil, fmt.Errorf("search records failed, because %v", err.Error())
	}
	return day_records, nil
}
func (c *DatabaseLocalClient) FetchRecordOrderByTimeAndBetweenStartAndEndOfTable(day_start int64, day_end int64) ([]map[string]interface{}, error) {
	var latest_records []map[string]interface{}
	if err := c.DB.Table(c.TableName).Where("last_operation_time >= ? AND last_operation_time <= ?", day_start, day_end).Order("last_operation_time DESC").Find(&latest_records).Error; err != nil {
		return nil, fmt.Errorf("find latest record failed, because %v", err.Error())
	}
	return latest_records, nil
}
func (c *DatabaseLocalClient) FetchRecordById(id string) ([]map[string]interface{}, error) {
	var local_records []map[string]interface{}
	if err := c.DB.Table(c.TableName).Where("id = ?", id).Limit(1).Find(&local_records).Error; err != nil {
		return nil, err
	}
	return local_records, nil
}
func (c *DatabaseLocalClient) SetRecords(v []map[string]interface{}) {
}

func NewDatabaseLocalClient(db *gorm.DB, tableName string) LocalClient {
	return &DatabaseLocalClient{
		DB:        db,
		TableName: tableName,
	}
}

type MockLocalClient struct {
	TableName string
	records   []map[string]interface{}
}

func (c *MockLocalClient) SetRecords(v []map[string]interface{}) {
	c.records = v
}

func (c *MockLocalClient) FetchTableLastRecord() (map[string]interface{}, error) {
	if len(c.records) == 0 {
		return nil, errors.New("no records available")
	}
	sorted := make([]map[string]interface{}, len(c.records))
	copy(sorted, c.records)
	sort.Slice(sorted, func(i, j int) bool {
		timeI, _ := strconv.ParseInt(sorted[i]["last_operation_time"].(string), 10, 64)
		timeJ, _ := strconv.ParseInt(sorted[j]["last_operation_time"].(string), 10, 64)
		if timeI == timeJ {
			return sorted[i]["id"].(string) > sorted[j]["id"].(string) // secondary sort by id descending
		}
		return timeI > timeJ
	})

	return sorted[0], nil
}
func (c *MockLocalClient) FetchUniqueDaysOfTable() []string {
	unique_days := make(map[string]struct{})
	var days []string
	for _, record := range c.records {
		ts, _ := strconv.ParseInt(record["created_at"].(string), 10, 64)
		t := time.Unix(ts/1000, 0)
		dayStr := t.Format("2006-01-02")

		if _, exists := unique_days[dayStr]; !exists {
			unique_days[dayStr] = struct{}{}
			days = append(days, dayStr)
		}
	}
	sort.Slice(days, func(i, j int) bool {
		ti, _ := time.Parse("2006-01-02", days[i])
		tj, _ := time.Parse("2006-01-02", days[j])
		return ti.Before(tj)
	})

	return days
}
func (c *MockLocalClient) FetchRecordsBetweenSpecialDayOfTable(day_str string) ([]map[string]interface{}, error) {
	targetDay, err := time.Parse("2006-01-02", day_str)
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	for _, record := range c.records {
		ts, _ := strconv.ParseInt(record["created_at"].(string), 10, 64)
		t := time.Unix(ts/1000, 0)
		if t.Format("2006-01-02") == targetDay.Format("2006-01-02") {
			result = append(result, record)
		}
	}

	// Sort by last_operation_time descending
	sort.Slice(result, func(i, j int) bool {
		timeI, _ := strconv.ParseInt(result[i]["last_operation_time"].(string), 10, 64)
		timeJ, _ := strconv.ParseInt(result[j]["last_operation_time"].(string), 10, 64)
		if timeI == timeJ {
			return result[i]["id"].(string) > result[j]["id"].(string) // secondary sort by id descending
		}
		return timeI > timeJ
	})

	return result, nil
}
func (c *MockLocalClient) FetchRecordOrderByTimeAndBetweenStartAndEndOfTable(day_start int64, day_end int64) ([]map[string]interface{}, error) {
	var filtered []map[string]interface{}

	for _, record := range c.records {
		ts, _ := strconv.ParseInt(record["last_operation_time"].(string), 10, 64)
		if ts >= day_start && ts <= day_end {
			filtered = append(filtered, record)
		}
	}
	if len(filtered) == 0 {
		return nil, errors.New("no records found in the specified range")
	}
	// Sort by last_operation_time descending
	sort.Slice(filtered, func(i, j int) bool {
		timeI, _ := strconv.ParseInt(filtered[i]["last_operation_time"].(string), 10, 64)
		timeJ, _ := strconv.ParseInt(filtered[j]["last_operation_time"].(string), 10, 64)
		if timeI == timeJ {
			return filtered[i]["id"].(string) > filtered[j]["id"].(string) // secondary sort by id descending
		}
		return timeI > timeJ
	})
	return filtered, nil
}
func (c *MockLocalClient) FetchRecordById(id string) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	for _, record := range c.records {
		if record["id"].(string) == id {
			result = append(result, record)
		}
	}
	if len(result) == 0 {
		return result, nil
	}
	return result, nil
}

func NewMockLocalClient(tableName string) LocalClient {
	return &MockLocalClient{
		TableName: tableName,
	}
}
