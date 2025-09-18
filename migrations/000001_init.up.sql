
--设置
CREATE TABLE IF NOT EXISTS setting(
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP -- 创建时间
);

--一次粘贴板变更
CREATE TABLE IF NOT EXISTS paste_event(
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL DEFAULT '', --内容类型
  details TEXT NOT NULL DEFAULT '{}', --变更详情
  content_id INTEGER NOT NULL, --粘贴板内容
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  deleted_at TIMESTAMP
);

--粘贴板上的内容
CREATE TABLE IF NOT EXISTS paste_content(
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL DEFAULT '', --内容类型
  text TEXT DEFAULT '', --文本内容
  html TEXT DEFAULT '', --html内容
  file_json TEXT DEFAULT '', --文件列表json
  image_base64 TEXT DEFAULT '', --图片base64
  other TEXT DEFAULT '', --其他
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  deleted_at TIMESTAMP
);