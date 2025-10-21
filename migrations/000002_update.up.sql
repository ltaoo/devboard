ALTER TABLE paste_event ADD COLUMN shortcut TEXT;
ALTER TABLE paste_event ADD COLUMN device_id TEXT;
ALTER TABLE paste_event ADD COLUMN app_name TEXT;


DELETE FROM category_node;
INSERT INTO category_node (id, label, last_operation_time, last_operation_type) VALUES
('text', 'text', '1760313600000', 1),
('image', 'image', '1760313600000', 1),
('file', 'file', '1760313600000', 1),
('html', 'html', '1760313600000', 1),
('code', 'code', '1760313600000', 1),
('prompt', 'prompt', '1760313600000', 1),
('snippet', 'snippet', '1760313600000', 1),
('url', 'url', '1760313600000', 1),
('time', 'time', '1760313600000', 1),
('color', 'color', '1760313600000', 1),
('command', 'command', '1760313600000', 1),
('JSON', 'JSON', '1760313600000', 1),
('XML', 'XML', '1760313600000', 1),
('HTML', 'HTML', '1760313600000', 1),
('Go', 'Go', '1760313600000', 1),
('Rust', 'Rust', '1760313600000', 1),
('Python', 'Python', '1760313600000', 1),
('Java', 'Java', '1760313600000', 1),
('JavaScript', 'JavaScript', '1760313600000', 1),
('TypeScript', 'TypeScript', '1760313600000', 1),
('SQL', 'SQL', '1760313600000', 1);


-- 2. 为 `category_hierarchy` 表添加 `id` 主键（TEXT 类型）
-- 2.1 创建新表（带 `id` 主键）
CREATE TABLE IF NOT EXISTS category_hierarchy_new (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    child_id TEXT,
    last_operation_time TEXT NOT NULL,
    last_operation_type INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (parent_id, child_id)
);
DROP TABLE IF EXISTS category_hierarchy;
ALTER TABLE category_hierarchy_new RENAME TO category_hierarchy;
INSERT INTO category_hierarchy (id, parent_id, child_id, last_operation_time, last_operation_type) VALUES
('code_JSON', 'code', 'JSON', '1760313600000', 1),
('code_XML', 'code', 'XML', '1760313600000', 1),
('code_HTML', 'code', 'HTML', '1760313600000', 1),
('code_Go', 'code', 'Go', '1760313600000', 1),
('code_Rust', 'code', 'Rust', '1760313600000', 1),
('code_Python', 'code', 'Python', '1760313600000', 1),
('code_Java', 'code', 'Java', '1760313600000', 1),
('code_JavaScript', 'code', 'JavaScript', '1760313600000', 1),
('code_TypeScript', 'code', 'TypeScript', '1760313600000', 1),
('code_SQL', 'code', 'SQL', '1760313600000', 1),
('snippet_JSON', 'snippet', 'JSON', '1760313600000', 1),
('snippet_XML', 'snippet', 'XML', '1760313600000', 1),
('snippet_HTML', 'snippet', 'HTML', '1760313600000', 1),
('snippet_Go', 'snippet', 'Go', '1760313600000', 1),
('snippet_Rust', 'snippet', 'Rust', '1760313600000', 1),
('snippet_Python', 'snippet', 'Python', '1760313600000', 1),
('snippet_Java', 'snippet', 'Java', '1760313600000', 1),
('snippet_JavaScript', 'snippet', 'JavaScript', '1760313600000', 1),
('snippet_TypeScript', 'snippet', 'TypeScript', '1760313600000', 1),
('snippet_SQL', 'snippet', 'SQL', '1760313600000', 1);


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
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  deleted_at TIMESTAMP
);

