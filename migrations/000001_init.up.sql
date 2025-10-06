
--设置
CREATE TABLE IF NOT EXISTS setting (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP -- 创建时间
);

--一次粘贴板变更事件
CREATE TABLE IF NOT EXISTS paste_event (
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

--数据同步
CREATE TABLE IF NOT EXISTS synchronize_task (
  id TEXT NOT NULL PRIMARY KEY,
  type INTEGER NOT NULL, --同步类型 远端到本地 or 本地到远端
  status INTEGER NOT NULL, --同步操作的结果
  details TEXT NOT NULL DEFAULT '{}', --同步操作详情
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS category_node (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  level INTEGER DEFAULT 0, -- 节点层级深度
  sort_order INTEGER DEFAULT 0, -- 同级节点排序
  is_active BOOLEAN DEFAULT 1,
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS category_hierarchy (
  parent_id TEXT,
  child_id TEXT,
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paste_event_category_mapping (
  id TEXT PRIMARY KEY,
  paste_event_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  last_operation_time TEXT NOT NULL, --最后一次操作的时间
  last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (paste_event_id) REFERENCES paste_event(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES category_node(id) ON DELETE CASCADE,
  UNIQUE (paste_event_id, category_id)
);

