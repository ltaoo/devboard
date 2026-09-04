const runtime = () => window.Timeless;
const settings_routes = new Set(["/settings", "/user_settings", "/shortcut", "/category", "/settings_synchronization", "/settings_system"]);
const home_routes = new Set(["/", "/home", "/home/index"]);
const passive_routes = new Set(["/helper_center", "/help/shortcut", "/debug_console", "/login", "/register", "/notfound"]);

export function is_settings_route(pathname) {
  return settings_routes.has(pathname);
}

function normalize_settings_route(pathname) {
  return pathname === "/settings" ? "/user_settings" : pathname;
}

export function format_time(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "时间未知";
  const date = new Date(number < 1e12 ? number * 1000 : number);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN");
}

export function parse_files(value) {
  try {
    const result = JSON.parse(value || "[]");
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export function summarize_record(record) {
  if (!record) return "";
  if (record.content_type === "file") {
    const files = parse_files(record.file_list_json);
    return files.map((file) => file.name || file.absolute_path).filter(Boolean).join("、") || "文件";
  }
  if (record.content_type === "image") return record.text || "图片";
  return String(record.text || record.details || "").trim() || "空内容";
}

export class AppModel {
  constructor(location = window.location) {
    const { ref, refarr } = runtime();
    this.route = location.pathname;
    this.query = new URLSearchParams(location.search);
    this.state = {
      records: refarr([]),
      categories: refarr([]),
      remarks: refarr([]),
      loading: ref(false),
      saving: ref(false),
      error: ref(""),
      notice: ref(""),
      keyword: ref(""),
      category_id: ref(""),
      active_record_index: ref(0),
      page: ref(1),
      has_more: ref(false),
      detail: ref(null),
      settings: ref(null),
      settings_page: ref(normalize_settings_route(this.route)),
      system_info: ref(null),
      database_fields: refarr([]),
      new_category_label: ref(""),
      debug_text: ref(""),
      selected_files: refarr([]),
    };
    this.notice_timer = 0;
    this.loaded_shortcut = "";
    this.last_escape_at = 0;
  }

  async start() {
    this.listen();
    if (this.route === "/preview") return this.load_detail(this.query.get("id"));
    if (is_settings_route(this.route)) return this.load_settings();
    if (["/image_preview", "/video_preview", "/pdf_preview"].includes(this.route)) return;
    if (this.route === "/error") return;
    if (passive_routes.has(this.route) || !home_routes.has(this.route)) return;
    await Promise.all([this.load_records(true), this.load_categories()]);
  }

  async call(path, body = {}, method = "POST") {
    let result;
    if (typeof window.invoke === "function") {
      result = await window.invoke(path, { method, args: body });
    } else {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      result = await response.json();
    }
    if (!result || result.code !== 0) throw new Error(result?.msg || "请求失败");
    return result.data;
  }

  async run(task, success_message = "") {
    this.state.error.as("");
    try {
      const result = await task();
      if (success_message) this.show_notice(success_message);
      return result;
    } catch (error) {
      this.state.error.as(error?.message || String(error));
      return null;
    }
  }

  async load_records(reset = false) {
    if (this.state.loading.value) return;
    this.state.loading.as(true);
    if (reset) this.state.page.as(1);
    await this.run(async () => {
      const data = await this.call("/api/paste/list", {
        page: this.state.page.value,
        page_size: 30,
        keyword: this.state.keyword.value.trim(),
        types: this.state.category_id.value ? [this.state.category_id.value] : [],
      });
      const list = data?.list || [];
      this.state.records.as(reset ? list : [...this.state.records.value, ...list]);
      if (reset) this.state.active_record_index.as(0);
      this.state.has_more.as(Boolean(data?.has_more));
      if (data?.has_more) this.state.page.as(this.state.page.value + 1);
    });
    this.state.loading.as(false);
  }

  async load_categories() {
    await this.run(async () => {
      const tree = await this.call("/api/category/tree", {}, "GET");
      this.state.categories.as(this.flatten_categories(tree || []));
    });
  }

  flatten_categories(nodes, depth = 0) {
    const result = [];
    for (const node of nodes || []) {
      result.push({ ...node, depth });
      result.push(...this.flatten_categories(node.children || [], depth + 1));
    }
    return result;
  }

  set_keyword(event) {
    this.state.keyword.as(this.event_value(event));
  }

  async search() {
    await this.load_records(true);
  }

  async select_category(category_id) {
    this.state.category_id.as(category_id);
    await this.load_records(true);
  }

  async create_category(label) {
    const category_label = String(label === undefined ? window.prompt("新分类名称") || "" : label).trim();
    if (!category_label) return;
    await this.run(async () => {
      await this.call("/api/category/create", { label: category_label, type: "tag", description: "", parent_id: null, children: [] });
      await this.load_categories();
    }, "分类已创建");
  }

  set_new_category_label(event) {
    this.state.new_category_label.as(this.event_value(event));
  }

  async create_settings_category() {
    const label = this.state.new_category_label.value;
    if (!label.trim()) return;
    await this.create_category(label);
    this.state.new_category_label.as("");
  }

  async copy(record) {
    await this.run(() => this.call("/api/paste/write", { paste_event_id: record.id }), "已复制到剪贴板");
  }

  active_record() {
    return this.state.records.value[this.state.active_record_index.value] || null;
  }

  activate_record(index) {
    const last_index = this.state.records.value.length - 1;
    this.state.active_record_index.as(Math.max(0, Math.min(index, last_index)));
  }

  move_active_record(step) {
    if (!this.state.records.value.length) return false;
    this.activate_record(this.state.active_record_index.value + step);
    return true;
  }

  async remove(record) {
    if (!window.confirm("删除这条剪贴板记录？")) return;
    await this.run(async () => {
      await this.call("/api/paste/delete", { paste_event_id: record.id });
      const record_index = this.state.records.value.findIndex((item) => item.id === record.id);
      this.state.records.as(this.state.records.value.filter((item) => item.id !== record.id));
      if (record_index >= 0 && record_index < this.state.active_record_index.value) this.state.active_record_index.as(this.state.active_record_index.value - 1);
      this.activate_record(this.state.active_record_index.value);
    }, "记录已删除");
  }

  async download(record) {
    const data = await this.run(() => this.call("/api/paste/download", { paste_event_id: record.id }));
    if (data && !data.cancel) this.show_notice("文件已保存");
  }

  async open_detail(record) {
    await this.run(() => this.call("/api/paste/preview", { paste_event_id: record.id, focus: true }));
  }

  async import_files() {
    const data = await this.run(() => this.call("/api/file/open", {}, "GET"));
    if (data && !data.cancel) {
      this.state.selected_files.as(data.files || []);
      this.show_notice(`已选择 ${(data.files || []).length} 个文件`);
    }
  }

  async open_settings() {
    await this.run(() => this.call("/api/common/window", { title: "Settings", url: "/settings", width: 720, height: 720 }));
  }

  async open_help() {
    await this.run(() => this.call("/api/common/window", { title: "快捷键说明", url: "/help/shortcut", width: 720, height: 720 }));
  }

  async load_detail(id) {
    if (!id) return this.state.error.as("缺少记录 ID");
    this.state.loading.as(true);
    await this.run(async () => {
      const detail = await this.call("/api/paste/profile", { paste_event_id: id });
      this.state.detail.as(detail);
      const remarks = await this.call("/api/remark/list", { paste_event_id: id, page: 1, page_size: 100, keyword: "" });
      this.state.remarks.as(remarks?.list || []);
    });
    this.state.loading.as(false);
  }

  async add_remark() {
    const detail = this.state.detail.value;
    const content = window.prompt("备注内容");
    if (!detail || !content?.trim()) return;
    await this.run(async () => {
      const created = await this.call("/api/remark/create", { paste_event_id: detail.id, content: content.trim() });
      this.state.remarks.as([created, ...this.state.remarks.value]);
    }, "备注已添加");
  }

  async remove_remark(remark) {
    await this.run(async () => {
      await this.call("/api/remark/delete", { id: remark.id });
      this.state.remarks.as(this.state.remarks.value.filter((item) => item.id !== remark.id));
    });
  }

  async load_settings() {
    this.state.loading.as(true);
    await this.run(async () => {
      const [settings, system_info, database, categories] = await Promise.all([
        this.call("/api/config/read", {}, "GET"),
        this.call("/api/system/info", {}, "GET"),
        this.call("/api/sync/dirs", {}, "GET"),
        this.call("/api/category/tree", {}, "GET"),
      ]);
      this.state.settings.as(settings || {});
      this.state.system_info.as(system_info || {});
      this.state.database_fields.as(database?.fields || []);
      this.state.categories.as(this.flatten_categories(categories || []));
      this.loaded_shortcut = settings?.shortcut?.toggle_main_window_visible || "";
    });
    this.state.loading.as(false);
  }

  setting(path) {
    let value = this.state.settings.value;
    for (const key of path.split(".")) value = value?.[key];
    return value ?? "";
  }

  update_setting(path, event, checkbox = false) {
    const settings = structuredClone(this.state.settings.value || {});
    const parts = path.split(".");
    let target = settings;
    for (const key of parts.slice(0, -1)) target = target[key] ||= {};
    const element = this.event_element(event);
    target[parts.at(-1)] = checkbox ? Boolean(element?.checked) : String(element?.value || "");
    this.state.settings.as(settings);
  }

  navigate_settings(pathname) {
    if (!is_settings_route(pathname)) return;
    this.state.settings_page.as(normalize_settings_route(pathname));
    window.history?.replaceState({}, "", pathname);
  }

  async save_settings() {
    this.state.saving.as(true);
    const paths = ["douyin.cookie", "paste_event.callback_endpoint", "shortcut.toggle_main_window_visible", "synchronize.webdav.url", "synchronize.webdav.username", "synchronize.webdav.password", "synchronize.webdav.root_dir", "auto_start"];
    await this.run(async () => {
      for (const path of paths) await this.call("/api/config/update", { path, value: this.setting(path) });
      await this.call("/api/system/autostart", { auto_start: Boolean(this.setting("auto_start")) });
      const shortcut = this.setting("shortcut.toggle_main_window_visible");
      if (this.loaded_shortcut && this.loaded_shortcut !== shortcut) {
        await this.call("/api/common/shortcut/unregister", { shortcut: this.loaded_shortcut, command: "ToggleMainWindowVisible" });
      }
      if (shortcut && this.loaded_shortcut !== shortcut) {
        await this.call("/api/common/shortcut/register", { shortcut, command: "ToggleMainWindowVisible" });
      }
      this.loaded_shortcut = shortcut;
    }, "设置已保存");
    this.state.saving.as(false);
  }

  webdav_body() {
    return {
      url: this.setting("synchronize.webdav.url"),
      username: this.setting("synchronize.webdav.username"),
      password: this.setting("synchronize.webdav.password"),
      root_dir: this.setting("synchronize.webdav.root_dir"),
      force: false,
      test: false,
    };
  }

  async sync(action) {
    const path = action === "ping" ? "/api/sync/ping" : action === "upload" ? "/api/sync/upload" : "/api/sync/download";
    await this.run(() => this.call(path, this.webdav_body()), action === "ping" ? "连接成功" : "同步完成");
  }

  async reveal_file(path) {
    await this.run(() => this.call("/api/file/reveal", { file_path: path }));
  }

  set_debug_text(event) {
    this.state.debug_text.as(this.event_value(event));
  }

  async create_mock_paste() {
    const text = this.state.debug_text.value.trim();
    if (!text) {
      this.state.error.as("请输入模拟粘贴内容");
      return;
    }
    const created = await this.run(() => this.call("/api/paste/mock", { text }), "模拟记录已创建");
    if (created) this.state.debug_text.as("");
  }

  navigate(pathname) {
    window.location.assign(pathname);
  }

  async hide_window() {
    if (typeof window.invoke === "function") await window.invoke("__velo/window/hide", { method: "POST", args: {} });
  }

  async close_window() {
    if (typeof window.invoke === "function") await window.invoke("__velo/window/close", { method: "POST", args: {} });
  }

  quit_app() {
    void this.call("/api/common/quit", {}, "GET").catch(() => {});
  }

  reload() {
    window.location.reload();
  }

  handle_keydown(event) {
    if (event.metaKey || event.ctrlKey) {
      if (event.key === ",") {
        event.preventDefault();
        this.open_settings();
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        this.reload();
      }
      if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        this.quit_app();
      }
      return false;
    }
    if (event.key === "Escape" && home_routes.has(this.route)) {
      const now = Date.now();
      if (now - this.last_escape_at <= 500) {
        event.preventDefault();
        this.last_escape_at = 0;
        void this.hide_window();
      } else {
        this.last_escape_at = now;
        this.event_element(event)?.blur?.();
      }
      return false;
    }
    this.last_escape_at = 0;
    if (!home_routes.has(this.route) || this.is_editing(event) || event.altKey) return false;
    if (["KeyK", "ArrowUp"].includes(event.code)) {
      event.preventDefault();
      return this.move_active_record(-1);
    }
    if (["KeyJ", "ArrowDown"].includes(event.code)) {
      event.preventDefault();
      return this.move_active_record(1);
    }
    const record = this.active_record();
    if (!record) return false;
    if (event.code === "Space") {
      event.preventDefault();
      this.open_detail(record);
    }
    if (event.code === "Enter") {
      event.preventDefault();
      this.copy(record);
    }
    return false;
  }

  is_editing(event) {
    const element = this.event_element(event);
    return ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName) || Boolean(element?.isContentEditable);
  }

  listen() {
    if (typeof window.onGoMessage !== "function") return;
    window.onGoMessage((payload) => {
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (payload?.name === "clipboard:update" && home_routes.has(this.route)) {
        if (this.state.records.value.length) this.state.active_record_index.as(this.state.active_record_index.value + 1);
        this.state.records.as([payload.data, ...this.state.records.value]);
      }
    });
  }

  file_url(path) {
    return `/file?f=${encodeURIComponent(path || "")}`;
  }

  event_element(event) {
    const target = event?.target;
    return target && typeof target.get$elm === "function" ? target.get$elm() : target;
  }

  event_value(event) {
    return String(this.event_element(event)?.value || "");
  }

  show_notice(message) {
    this.state.notice.as(message);
    window.clearTimeout(this.notice_timer);
    this.notice_timer = window.setTimeout(() => this.state.notice.as(""), 2400);
  }
}
