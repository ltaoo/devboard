CREATE TABLE IF NOT EXISTS paste_event_02 (
    id TEXT NOT NULL PRIMARY KEY, 
    content_type TEXT NOT NULL, --内容类型
    details TEXT NOT NULL DEFAULT '{}', --变更详情
    text TEXT, --文本内容
    html TEXT, --html内容
    file_list_json TEXT, --文件列表json
    image_base64 TEXT, --图片base64
    other TEXT, --其他
    shortcut TEXT,
    device_id TEXT,
    app_id TEXT,
    last_operation_time TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), --最后一次操作的时间
    last_operation_type INTEGER NOT NULL DEFAULT 1, --最后一次操作的类型 1新增 2编辑 3删除
    sync_status INTEGER NOT NULL DEFAULT 1, --1未同步 2已同步
    created_at TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), -- 创建时间
    updated_at TEXT,
    deleted_at TIMESTAMP
);
INSERT INTO paste_event_02 (id, content_type, details, text, html, file_list_json, image_base64, other, last_operation_time, last_operation_type, created_at, deleted_at)
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
    CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER),
    deleted_at
FROM paste_event;
DROP TABLE IF EXISTS paste_event;
ALTER TABLE paste_event_02 RENAME TO paste_event;

CREATE TABLE IF NOT EXISTS category_node_02 (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  level INTEGER DEFAULT 0, -- 节点层级深度
  sort_order INTEGER DEFAULT 0, -- 同级节点排序
  is_active BOOLEAN DEFAULT 1,
  last_operation_time TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), --最后一次操作的时间
  last_operation_type INTEGER NOT NULL DEFAULT 1, --最后一次操作的类型 1新增 2编辑 3删除
  sync_status INTEGER NOT NULL DEFAULT 1, --1未同步 2已同步
  created_at TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at TEXT,
  deleted_at TIMESTAMP
);
INSERT INTO category_node_02 (id, label, last_operation_time, last_operation_type, created_at) VALUES
('text', 'text', '1760313600000', 1, '1760313600000'),
('image', 'image', '1760313600000', 1, '1760313600000'),
('file', 'file', '1760313600000', 1, '1760313600000'),
('html', 'html', '1760313600000', 1, '1760313600000'),
('code', 'code', '1760313600000', 1, '1760313600000'),
('prompt', 'prompt', '1760313600000', 1, '1760313600000'),
('snippet', 'snippet', '1760313600000', 1, '1760313600000'),
('url', 'url', '1760313600000', 1, '1760313600000'),
('time', 'time', '1760313600000', 1, '1760313600000'),
('color', 'color', '1760313600000', 1, '1760313600000'),
('command', 'command', '1760313600000', 1, '1760313600000'),
('JSON', 'JSON', '1760313600000', 1, '1760313600000'),
('XML', 'XML', '1760313600000', 1, '1760313600000'),
('HTML', 'HTML', '1760313600000', 1, '1760313600000'),
('Go', 'Go', '1760313600000', 1, '1760313600000'),
('Rust', 'Rust', '1760313600000', 1, '1760313600000'),
('Python', 'Python', '1760313600000', 1, '1760313600000'),
('Java', 'Java', '1760313600000', 1, '1760313600000'),
('JavaScript', 'JavaScript', '1760313600000', 1, '1760313600000'),
('TypeScript', 'TypeScript', '1760313600000', 1, '1760313600000'),
('SQL', 'SQL', '1760313600000', 1, '1760313600000');
DROP TABLE IF EXISTS category_node;
ALTER TABLE category_node_02 RENAME TO category_node;

-- 2. 为 `category_hierarchy` 表添加 `id` 主键（TEXT 类型）
-- 2.1 创建新表（带 `id` 主键）
CREATE TABLE IF NOT EXISTS category_hierarchy_02 (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    child_id TEXT,
    last_operation_time TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000),
    last_operation_type INTEGER NOT NULL DEFAULT 1,
    sync_status INTEGER NOT NULL DEFAULT 1, --1未同步 2已同步
    created_at TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000),
    updated_at TEXT,
    deleted_at TIMESTAMP,
    UNIQUE (parent_id, child_id)
);
INSERT INTO category_hierarchy_02 (id, parent_id, child_id, last_operation_time, last_operation_type, created_at) VALUES
('code_JSON', 'code', 'JSON', '1760313600000', 1, '1760313600000'),
('code_XML', 'code', 'XML', '1760313600000', 1, '1760313600000'),
('code_HTML', 'code', 'HTML', '1760313600000', 1, '1760313600000'),
('code_Go', 'code', 'Go', '1760313600000', 1, '1760313600000'),
('code_Rust', 'code', 'Rust', '1760313600000', 1, '1760313600000'),
('code_Python', 'code', 'Python', '1760313600000', 1, '1760313600000'),
('code_Java', 'code', 'Java', '1760313600000', 1, '1760313600000'),
('code_JavaScript', 'code', 'JavaScript', '1760313600000', 1, '1760313600000'),
('code_TypeScript', 'code', 'TypeScript', '1760313600000', 1, '1760313600000'),
('code_SQL', 'code', 'SQL', '1760313600000', 1, '1760313600000'),
('snippet_JSON', 'snippet', 'JSON', '1760313600000', 1, '1760313600000'),
('snippet_XML', 'snippet', 'XML', '1760313600000', 1, '1760313600000'),
('snippet_HTML', 'snippet', 'HTML', '1760313600000', 1, '1760313600000'),
('snippet_Go', 'snippet', 'Go', '1760313600000', 1, '1760313600000'),
('snippet_Rust', 'snippet', 'Rust', '1760313600000', 1, '1760313600000'),
('snippet_Python', 'snippet', 'Python', '1760313600000', 1, '1760313600000'),
('snippet_Java', 'snippet', 'Java', '1760313600000', 1, '1760313600000'),
('snippet_JavaScript', 'snippet', 'JavaScript', '1760313600000', 1, '1760313600000'),
('snippet_TypeScript', 'snippet', 'TypeScript', '1760313600000', 1, '1760313600000'),
('snippet_SQL', 'snippet', 'SQL', '1760313600000', 1, '1760313600000');
DROP TABLE IF EXISTS category_hierarchy;
ALTER TABLE category_hierarchy_02 RENAME TO category_hierarchy;

CREATE TABLE IF NOT EXISTS paste_event_category_mapping_02 (
  id TEXT PRIMARY KEY,
  paste_event_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  last_operation_time TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), --最后一次操作的时间
  last_operation_type INTEGER NOT NULL DEFAULT 1, --最后一次操作的类型 1新增 2编辑 3删除
  sync_status INTEGER NOT NULL DEFAULT 1, --1未同步 2已同步
  created_at TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at TEXT,
  deleted_at TIMESTAMP,
  FOREIGN KEY (paste_event_id) REFERENCES paste_event(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES category_node(id) ON DELETE CASCADE,
  UNIQUE (paste_event_id, category_id)
);
INSERT INTO paste_event_category_mapping_02 (id, paste_event_id, category_id, last_operation_time, last_operation_type, created_at, deleted_at)
SELECT
   id,
   paste_event_id,
   category_id,
   last_operation_time,
   last_operation_type,
   CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER),
   deleted_at
FROM paste_event_category_mapping;
DROP TABLE IF EXISTS paste_event_category_mapping;
ALTER TABLE paste_event_category_mapping_02 RENAME TO paste_event_category_mapping;


CREATE TABLE IF NOT EXISTS remark (
  id TEXT NOT NULL PRIMARY KEY,
  content TEXT NOT NULL, --内容
  paste_event_id TEXT NOT NULL,
  last_operation_time TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), --最后一次操作的时间
  last_operation_type INTEGER NOT NULL DEFAULT 1, --最后一次操作的类型 1新增 2编辑 3删除
  sync_status INTEGER NOT NULL DEFAULT 1, --1未同步 2已同步
  created_at TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), -- 创建时间
  updated_at TEXT,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL, --名称
  unique_id TEXT,
  logo_url TEXT,
  last_operation_time TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), --最后一次操作的时间
  last_operation_type INTEGER NOT NULL DEFAULT 1, --最后一次操作的类型 1新增 2编辑 3删除
  sync_status INTEGER NOT NULL DEFAULT 1, --1未同步 2已同步
  created_at TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), -- 创建时间
  updated_at TEXT,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL, --名称
  mac_address TEXT, --mac地址
  last_operation_time TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), --最后一次操作的时间
  last_operation_type INTEGER NOT NULL DEFAULT 1, --最后一次操作的类型 1新增 2编辑 3删除
  sync_status INTEGER NOT NULL DEFAULT 1, --1未同步 2已同步
  created_at TEXT NOT NULL DEFAULT (strftime('%s','now') * 1000), -- 创建时间
  updated_at TEXT,
  deleted_at TIMESTAMP
);

