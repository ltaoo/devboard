
--设置
CREATE TABLE IF NOT EXISTS setting(
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP -- 创建时间
);

--一次粘贴板变更事件
CREATE TABLE IF NOT EXISTS paste_event(
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

CREATE TABLE IF NOT EXISTS sync_task(
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  sync_time TEXT NOT NULL, --同步操作的时间
  task_status INTEGER NOT NULL --同步操作的结果
)
