
ALTER TABLE paste_event ADD COLUMN shortcut TEXT;
ALTER TABLE paste_event ADD COLUMN device_id TEXT;
ALTER TABLE paste_event ADD COLUMN app_name TEXT;

-- 2. 为 `category_hierarchy` 表添加 `id` 主键（TEXT 类型）
-- 2.1 创建新表（带 `id` 主键）
CREATE TABLE IF NOT EXISTS category_hierarchy_new (
    id TEXT PRIMARY KEY,  -- 手动维护的 TEXT 主键
    parent_id TEXT,
    child_id TEXT,
    last_operation_time TEXT NOT NULL,
    last_operation_type INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
-- 2.2 迁移数据（假设 `id` 由 `parent_id` 和 `child_id` 组合生成）
INSERT INTO category_hierarchy_new (id, parent_id, child_id, last_operation_time, last_operation_type, created_at, updated_at, deleted_at)
SELECT
    parent_id || '_' || child_id AS id,  -- 示例：组合 parent_id + child_id 作为 id
    parent_id,
    child_id,
    last_operation_time,
    last_operation_type,
    created_at,
    updated_at,
    deleted_at
FROM category_hierarchy;
-- 2.3 删除旧表
DROP TABLE IF EXISTS category_hierarchy;
-- 2.4 重命名新表为正式表名
ALTER TABLE category_hierarchy_new RENAME TO category_hierarchy;


CREATE TABLE IF NOT EXISTS remark (
  id TEXT NOT NULL PRIMARY KEY,
  content TEXT NOT NULL, --内容
  paste_event_id TEXT NOT NULL,
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL, --名称
  mac_address TEXT, --mac地址
  ip_address TEXT, --ip地址
  device_type TEXT, --设备类型
  device_model TEXT, --设备型号
  device_version TEXT, --设备版本
  device_name TEXT, --设备名称
  device_description TEXT, --设备描述
  device_status TEXT, --设备状态
  device_status_code TEXT, --设备状态码
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  deleted_at TIMESTAMP
);

