CREATE TABLE IF NOT EXISTS category_node (
    node_id TEXT PRIMARY KEY,
    parent_id TEXT NULL, -- 父节点ID，NULL表示根节点
    node_name TEXT NOT NULL,
    description TEXT,
    level INTEGER DEFAULT 0, -- 节点层级深度
    sort_order INTEGER DEFAULT 0, -- 同级节点排序
    is_active BOOLEAN DEFAULT 1,
    last_operation_time TEXT NOT NULL, --最后一次操作的时间
    last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES category_node(node_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paste_event_category_mapping (
    mapping_id TEXT PRIMARY KEY,
    paste_event_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    last_operation_time TEXT NOT NULL, --最后一次操作的时间
    last_operation_type INTEGER NOT NULL, --最后一次操作的类型 1新增 2编辑 3删除
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    FOREIGN KEY (paste_event_id) REFERENCES paste_event(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id) REFERENCES category_node(node_id) ON DELETE CASCADE,
    UNIQUE (paste_event_id, node_id)
);

