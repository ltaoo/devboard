CREATE TABLE IF NOT EXISTS paste_event_01 (
    id TEXT NOT NULL PRIMARY KEY, 
    content_type TEXT NOT NULL, --内容类型
    details TEXT NOT NULL DEFAULT '{}', --变更详情
    text TEXT, --文本内容
    html TEXT, --html内容
    file_list_json TEXT, --文件列表json
    image_base64 TEXT, --图片base64
    other TEXT, --其他
    last_operation_time TEXT NOT NULL, --最后一次操作的时间
    last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    deleted_at TIMESTAMP
);
INSERT INTO paste_event_01 (id, content_type, details, text, html, file_list_json, image_base64, other, last_operation_time, last_operation_type, created_at, deleted_at)
SELECT
    id,
    content_type,
    details,
    text,
    html,
    file_list_json,
    image_base64,
    other,
    last_operation_time,
    last_operation_type,
    datetime(CAST(created_at AS INTEGER)/1000, 'unixepoch', 'localtime'),
    deleted_at
FROM paste_event;
DROP TABLE IF EXISTS paste_event;
ALTER TABLE paste_event_01 RENAME TO paste_event;


CREATE TABLE IF NOT EXISTS category_hierarchy_01 (
    parent_id TEXT NOT NULL,
    child_id TEXT NOT NULL,
    last_operation_time TEXT NOT NULL, --最后一次操作的时间
    last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
INSERT INTO category_hierarchy_01 (parent_id, child_id, last_operation_time, last_operation_type, created_at, updated_at, deleted_at)
SELECT
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
ALTER TABLE category_hierarchy_01 RENAME TO category_hierarchy;


CREATE TABLE IF NOT EXISTS paste_event_category_mapping_01 (
  id TEXT PRIMARY KEY,
  paste_event_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (paste_event_id) REFERENCES paste_event(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES category_node(id) ON DELETE CASCADE,
  UNIQUE (paste_event_id, category_id)
);
INSERT INTO paste_event_category_mapping_01 (id, paste_event_id, category_id, last_operation_time, last_operation_type, created_at, deleted_at)
SELECT
   id,
   paste_event_id,
   category_id,
   last_operation_time,
   last_operation_type,
   datetime(CAST(created_at AS INTEGER)/1000, 'unixepoch', 'localtime'),
   deleted_at
FROM paste_event_category_mapping;
DROP TABLE IF EXISTS paste_event_category_mapping;
ALTER TABLE paste_event_category_mapping_01 RENAME TO paste_event_category_mapping;


DROP TABLE IF EXISTS remark;
DROP TABLE IF EXISTS app;
DROP TABLE IF EXISTS device;
