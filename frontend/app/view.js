const {
  View,
  Button: TimelessButton,
  Input: TimelessInput,
  Textarea: TimelessTextarea,
  Img,
  Video,
  Webview,
  Icon: TimelessIcon,
  Show,
  For,
  computed,
  combine,
} = window.Timeless;

function N(name, props = {}, children = []) {
  return View({ ...props, attributes: { n: name, ...(props.attributes || {}) } }, children);
}

function Icon(name, icon_name, class_name = "w-4 h-4") {
  return TimelessIcon({ name: icon_name, class: class_name, attributes: { n: name, "aria-hidden": "true" } });
}

function event_once(handler) {
  if (!handler) return undefined;
  const handled = new WeakSet();
  return (event) => {
    if (handled.has(event)) return;
    handled.add(event);
    handler(event);
  };
}

function Button(name, label, on_click, options = {}) {
  const variant = options.variant || "default";
  const size = options.size || "default";
  const variants = {
    default: "bg-w-bg-5 text-w-fg-0",
    destructive: "bg-red-500 text-white hover:bg-red-600",
    outline: "bg-transparent border-2 border-w-fg-3",
    subtle: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100",
    link: "bg-transparent underline-offset-4 hover:underline text-w-fg-0",
  };
  const sizes = { default: "py-2 px-4", sm: "py-1 px-2 text-sm", lg: "px-4 text-lg" };
  const children = [];
  if (options.icon) children.push(Icon(`${name}-icon`, options.icon, options.icon_class));
  children.push(label);
  return TimelessButton({
    class: `overflow-hidden inline-flex items-center justify-center gap-2 text-md rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${options.class || ""}`,
    disabled: options.disabled,
    attributes: { n: name, type: "button", "aria-label": options.label || (typeof label === "string" ? label : name) },
    onClick: on_click,
  }, children);
}

function Input(name, value, on_input, options = {}) {
  const dimensions = options.type === "checkbox" ? "w-4 h-4 p-0 rounded" : "h-10 w-full py-2 px-3 rounded-xl";
  return TimelessInput({
    value,
    placeholder: options.placeholder || "",
    class: `flex items-center ${dimensions} leading-none border-2 border-w-fg-3 text-w-fg-0 bg-transparent focus:outline-none focus:ring-w-bg-3 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-w-fg-2 ${options.class || ""}`,
    attributes: {
      n: name,
      type: options.type || "text",
      checked: options.checked,
      spellcheck: options.spellcheck,
      "aria-label": options.label || name,
    },
    onInput: on_input,
    onChange: options.onChange,
    onBlur: event_once(options.onBlur),
    onKeyDown: event_once(options.onKeyDown),
  });
}

function Textarea(name, value, on_input, options = {}) {
  return TimelessTextarea({
    value,
    placeholder: options.placeholder || "",
    class: `flex h-20 w-full rounded-xl border-2 border-w-fg-3 text-w-fg-0 bg-transparent py-2 px-3 placeholder:text-w-fg-2 focus:outline-none focus:ring-2 focus:ring-w-bg-3 disabled:cursor-not-allowed disabled:opacity-50 ${options.class || ""}`,
    attributes: { n: name, rows: options.rows || 4, spellcheck: options.spellcheck ?? false, "aria-label": options.label || name },
    onInput: on_input,
    onBlur: event_once(options.onBlur),
    onKeyDown: event_once(options.onKeyDown),
  });
}

function Shell(model, content) {
  const handle_keydown = (event) => {
    if (!model.handle_keydown(event)) return;
    window.requestAnimationFrame(() => document.querySelector(`[data-home-card-idx="${model.state.active_record_index.value}"]`)?.scrollIntoView({ block: "nearest" }));
  };
  return N("application-shell", {
	class: "screen w-screen h-screen select-none transition-all duration-120",
	attributes: { tabindex: "-1" },
    onMounted: () => {
      document.addEventListener("keydown", handle_keydown);
      return () => document.removeEventListener("keydown", handle_keydown);
    },
	}, [
	content,
    Show({ when: model.state.error, ok: () => N("global-error", { class: "fixed z-[99999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-6 w-80 rounded-xl bg-black/90 text-center text-white", attributes: { role: "alert" } }, [model.state.error]) }),
    Show({ when: model.state.notice, ok: () => N("global-notice", { class: "fixed z-[99999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-6 w-80 rounded-xl bg-black/90 text-center text-white", attributes: { role: "status" } }, [model.state.notice]) }),
  ]);
}

function HomeMenu(name, icon_name, on_click, highlighted = false) {
  return N(name, { class: `relative flex items-center justify-center p-2 text-w-fg-0 cursor-pointer ${highlighted ? "bg-w-brand" : ""}`, onClick: on_click }, [
    N(`${name}-inner`, { class: "z-10 relative flex flex-col items-center" }, [
      N(`${name}-icon-wrap`, { class: `relative inline-block ${highlighted ? "text-w-fg-0" : "text-w-fg-2 hover:text-w-fg-1"}` }, [Icon(`${name}-icon`, icon_name, "w-6 h-6")]),
    ]),
  ]);
}

function HomeLayout(model, content) {
  return Shell(model, N("home-layout", { class: "flex w-full h-full" }, [
    N("home-sidebar", { class: "flex flex-col justify-between border-r border-w-fg-3 bg-w-bg-1" }, [
      N("home-primary-menu", { class: "relative z-10 p-2 space-y-2" }, [
        HomeMenu("home-menu-clipboard", "scroll-text", () => model.navigate("/home/index"), true),
        HomeMenu("home-menu-settings", "settings", () => model.open_settings()),
      ]),
      N("home-secondary-menu", { class: "relative z-10 p-2 space-y-2" }, [HomeMenu("home-menu-help", "circle-alert", () => model.open_help())]),
    ]),
    N("home-route-content", { class: "z-0 flex-1 relative w-0 h-full" }, [content]),
  ]));
}

function SearchView(model) {
  return N("home-search", { class: "search-box relative p-4 pb-0" }, [
    N("home-search-input-shell", { class: "flex items-center border-2 border-w-fg-3 bg-w-bg-3 rounded-md p-2 space-x-2" }, [
      N("home-search-selected-tags", { class: "flex space-x-1" }, [
        For({ each: model.state.categories, key: "id", render: (category) => Show({
          when: computed(model.state.category_id, (id) => id === category.id),
          ok: () => N(`home-search-selected-${category.id}`, { class: "bg-w-fg-3 rounded-md px-2" }, [N(`home-search-selected-${category.id}-label`, { class: "text-w-fg-0 text-sm whitespace-nowrap" }, [category.label])]),
        }) }),
      ]),
      Input("home-search-input", model.state.keyword, (event) => model.set_keyword(event), { class: "h-auto p-0 border-0 rounded-none", placeholder: "搜索", onKeyDown: (event) => event.key === "Enter" && model.search() }),
    ]),
    N("home-search-category-picker", { class: "search-picker absolute z-50 left-4 top-[60px] min-w-[4rem] w-36 max-h-56 overflow-y-auto p-1 rounded-xl border-2 border-w-fg-3 bg-w-bg-1 text-w-fg-0 shadow-md" }, [
      N("home-search-category-all", { class: "relative flex cursor-default select-none items-center rounded-xl py-1.5 px-2 hover:bg-w-bg-3", onClick: () => model.select_category("") }, ["全部"]),
      For({ each: model.state.categories, key: "id", render: (category) => N(`home-search-category-${category.id}`, { class: "relative flex cursor-default select-none items-center rounded-xl py-1.5 px-2 hover:bg-w-bg-3", onClick: () => model.select_category(category.id) }, [`${"　".repeat(category.depth || 0)}${category.label}`]) }),
      N("home-search-category-create", { class: "relative flex cursor-default select-none items-center gap-1 rounded-xl py-1.5 px-2 hover:bg-w-bg-3", onClick: () => model.create_category() }, [Icon("home-search-category-create-icon", "plus", "w-4 h-4"), "新建标签"]),
    ]),
  ]);
}

function FileContent(record, model, name) {
  const files = window.DevboardHelpers.parse_files(record.file_list_json);
  return N(`${name}-files`, { class: "w-full p-2 overflow-auto whitespace-nowrap scroll--hidden" }, files.map((file, index) => N(`${name}-file-${index}`, {}, [
    N(`${name}-file-${index}-action`, { class: "inline-flex items-center gap-1 cursor-pointer hover:underline", onClick: (event) => { event.stopPropagation(); model.reveal_file(file.absolute_path); } }, [
      Icon(`${name}-file-${index}-icon`, file.mime_type === "folder" ? "folder" : "file", "w-4 h-4 text-w-fg-1"),
      N(`${name}-file-${index}-name`, { class: "text-w-fg-0" }, [file.name || file.absolute_path]),
    ]),
  ])));
}

function RecordContent(record, model, name, expanded = false) {
  if (record.content_type === "file") return FileContent(record, model, name);
  if (record.content_type === "image" && record.image_base64) {
    return Img({ src: `data:image/png;base64,${record.image_base64}`, alt: record.text || "剪贴板图片", loading: "lazy", class: `${expanded ? "w-full h-auto object-contain" : "absolute w-full h-full object-cover"} rounded-md`, attributes: { n: `${name}-image` } });
  }
  if (record.content_type === "html" && record.html) {
    return N(`${name}-html`, { class: "html-content p-2 text-w-fg-0 break-all", onMounted: ({ target }) => { const element = target?.get$elm?.(); if (element) element.innerHTML = record.html; } }, []);
  }
  return N(`${name}-text`, { class: "p-2 text-w-fg-0 break-all content-code" }, [record.text || record.details || ""]);
}

function RecordCard(record, model, index) {
  const name = `home-record-${record.id}`;
  return N(name, { class: computed(model.state.active_record_index, (active_index) => `paste-event-card group relative p-2 rounded-md outline outline-2 outline-w-fg-3 select-text ${active_index === index ? "bg-w-fg-5" : ""}`), attributes: { "data-home-card-idx": index }, onPointerEnter: () => model.activate_record(index), onClick: () => model.activate_record(index), onDoubleClick: () => model.open_detail(record) }, [
    N(`${name}-content`, { class: "paste-event-card__content" }, [
      N(`${name}-preview`, { class: "relative overflow-hidden rounded-md h-[34px]" }, [RecordContent(record, model, name)]),
      N(`${name}-footer`, { class: "flex items-center justify-between mt-1" }, [
        N(`${name}-tags`, { class: "flex items-center space-x-1 tags overflow-hidden" }, [
          N(`${name}-index`, { class: "px-2 bg-w-bg-5 rounded-full" }, [N(`${name}-index-text`, { class: "text-w-fg-0 text-sm", attributes: { title: record.id } }, [`#${index + 1}`])]),
          ...(record.categories || []).map((category) => N(`${name}-category-${category.id}`, { class: "px-2 bg-w-bg-5 rounded-full" }, [N(`${name}-category-${category.id}-label`, { class: "text-w-fg-0 text-sm" }, [`#${category.label}`])])),
        ]),
        N(`${name}-tools`, { class: "flex items-center h-[32px]" }, [
          N(`${name}-time`, { class: computed(model.state.active_record_index, (active_index) => `time justify-between group-hover:hidden ${active_index === index ? "hidden" : "flex"}`), attributes: { title: window.DevboardHelpers.format_time(record.updated_at || record.created_at) } }, [N(`${name}-time-text`, { class: "text-sm text-w-fg-1" }, [window.DevboardHelpers.format_time(record.updated_at || record.created_at)])]),
          N(`${name}-operations`, { class: computed(model.state.active_record_index, (active_index) => `operations group-hover:flex items-center gap-1 ${active_index === index ? "flex" : "hidden"}`) }, [
            record.content_type !== "file" ? N(`${name}-download`, { class: "p-1 rounded-md cursor-pointer hover:bg-w-bg-5", onClick: (event) => { event.stopPropagation(); model.download(record); } }, [Icon(`${name}-download-icon`, "download", "w-4 h-4 text-w-fg-0")]) : null,
            N(`${name}-delete`, { class: "p-1 rounded-md cursor-pointer hover:bg-w-bg-5", onClick: (event) => { event.stopPropagation(); model.remove(record); } }, [Icon(`${name}-delete-icon`, "trash", "w-4 h-4 text-w-fg-0")]),
            N(`${name}-copy`, { class: "p-1 rounded-md cursor-pointer hover:bg-w-bg-5", onClick: (event) => { event.stopPropagation(); model.copy(record); } }, [Icon(`${name}-copy-icon`, "copy", "w-4 h-4 text-w-fg-0")]),
          ].filter(Boolean)),
        ]),
      ]),
    ]),
  ]);
}

function HomeView(model) {
  return HomeLayout(model, N("home-page", { class: "relative w-full h-full" }, [
    N("home-scroll-view", {
      class: "z-0 relative w-full h-full overflow-y-auto bg-w-bg-0 scroll--hidden",
      onMounted: ({ target }) => {
        const element = target?.get$elm?.();
        if (!element) return undefined;
        const load_more = () => {
          const to_bottom = element.scrollHeight - element.clientHeight - element.scrollTop;
          if (model.state.has_more.value && to_bottom <= 500) model.load_records(false);
        };
        element.addEventListener("scroll", load_more);
        return () => element.removeEventListener("scroll", load_more);
      },
    }, [
      SearchView(model),
      Show({ when: computed(model.state.selected_files, (files) => files.length > 0), ok: () => N("home-selected-files", { class: "mx-4 mt-2 px-2 py-1 rounded-md bg-w-bg-3 text-sm text-w-fg-1" }, [computed(model.state.selected_files, (files) => `已选择：${files.map((file) => file.name).join("、")}`)]) }),
      N("home-waterfall", { class: "relative p-4 space-y-3" }, [
        For({ each: model.state.records, key: "id", render: (record, index) => RecordCard(record, model, index.value) }),
        Show({ when: combine([model.state.loading, model.state.records], (loading, records) => loading && records.length === 0), ok: () => N("home-records-loading", { class: "w-full h-[360px] flex items-center justify-center text-w-fg-1", attributes: { role: "status" } }, [Icon("home-records-loading-icon", "loader", "w-6 h-6 animate-spin")]) }),
        Show({ when: combine([model.state.loading, model.state.records], (loading, records) => !loading && records.length === 0), ok: () => N("home-records-empty", { class: "w-full h-[360px] flex flex-col items-center justify-center text-w-fg-1" }, [Icon("home-records-empty-icon", "inbox", "w-24 h-24"), N("home-records-empty-text", { class: "mt-4 text-center text-xl" }, ["列表为空"])]) }),
        Show({ when: model.state.has_more, ok: () => N("home-load-more", { class: "mt-4 flex justify-center py-4 text-w-fg-1" }, [Button("home-load-more-action", computed(model.state.loading, (loading) => loading ? "" : "加载更多"), () => model.load_records(false), { variant: "link", icon: "square-arrow-down" })]) }),
        Show({ when: combine([model.state.has_more, model.state.records], (has_more, records) => !has_more && records.length > 0), ok: () => N("home-no-more", { class: "mt-4 flex justify-center py-4 text-w-fg-1 text-sm" }, ["没有数据了"]) }),
      ]),
    ]),
  ]));
}

function DetailPreview(model, detail) {
  const name = "detail-preview";
  if (detail.content_type === "image" && detail.image_base64) {
    return Img({ src: `data:image/png;base64,${detail.image_base64}`, alt: detail.text || "剪贴板图片", class: "max-w-full max-h-full object-contain", attributes: { n: `${name}-image` } });
  }
  if (detail.content_type === "file") {
    return N(`${name}-files`, { class: "max-w-[60vw] p-4 rounded-md bg-w-bg-3 space-y-2" }, window.DevboardHelpers.parse_files(detail.file_list_json).map((file, index) => N(`${name}-file-${index}`, {}, [
      N(`${name}-file-${index}-name`, { class: "text-w-fg-0" }, [file.name]),
      N(`${name}-file-${index}-path`, { class: "text-sm text-w-fg-1 cursor-pointer", onClick: () => model.reveal_file(file.absolute_path) }, [file.absolute_path]),
    ])));
  }
  if (detail.content_type === "html" && (detail.html || detail.text)) {
    return N(`${name}-html`, { class: "html-content overflow-y-auto max-w-[60vw] max-h-[80vh] p-4 rounded-md bg-w-bg-3", onMounted: ({ target }) => { const element = target?.get$elm?.(); if (element) element.innerHTML = detail.html || detail.text; } }, []);
  }
  return N(`${name}-text`, { class: "max-w-[60vw] max-h-[80vh] overflow-auto p-4 rounded-md bg-w-bg-3 content-code" }, [detail.text || detail.details || ""]);
}

function DetailContent(model, detail) {
  return N("detail-content", { class: "content flex h-full" }, [
    N("detail-preview-panel", { class: "content__preview relative flex-1 w-0 h-full flex items-center justify-center p-4 overflow-hidden" }, [DetailPreview(model, detail)]),
    N("detail-profile-panel", { class: "content_profile overflow-y-auto w-[280px] h-full p-4 bg-w-bg-3" }, [
      N("detail-profile-inner", {}, [
        N("detail-categories", { class: "paste_categories flex gap-1 flex-wrap" }, (detail.categories || []).map((category) => N(`detail-category-${category.id}`, { class: "px-2 py-1 rounded-md bg-w-fg-3" }, [N(`detail-category-${category.id}-label`, { class: "text-w-fg-0 text-[12px]" }, [category.label])]))),
        N("detail-fields", { class: "fields mt-4 space-y-2" }, [
          N("detail-created-field", { class: "field" }, [N("detail-created-label", { class: "text-w-fg-1 text-[12px]" }, ["创建时间"]), N("detail-created-value", { class: "text-w-fg-0" }, [window.DevboardHelpers.format_time(detail.updated_at || detail.created_at)])]),
          N("detail-app-field", { class: "field text-w-fg-1 text-sm" }, [N("detail-app-label", { class: "text-w-fg-1 text-[12px]" }, ["应用"]), N("detail-app-value", { class: "text-w-fg-0" }, [detail.app?.name || "-"])]),
          N("detail-device-field", { class: "field text-w-fg-1 text-sm" }, [N("detail-device-label", { class: "text-w-fg-1 text-[12px]" }, ["设备"]), N("detail-device-value", { class: "text-w-fg-0" }, [detail.device?.name || "-"])]),
        ]),
        N("detail-actions", { class: "mt-4 flex gap-1" }, [
          Button("detail-copy", "复制", () => model.copy(detail), { size: "sm" }),
          detail.content_type !== "file" ? Button("detail-download", "保存", () => model.download(detail), { size: "sm" }) : null,
        ].filter(Boolean)),
        N("detail-remarks", { class: "remark mt-4 text-w-fg-0" }, [
          N("detail-remarks-label", { class: "text-w-fg-1 text-[12px]" }, ["备注"]),
          N("detail-remark-list", { class: "mt-1 space-y-2" }, [
            For({ each: model.state.remarks, key: "id", render: (remark) => N(`detail-remark-${remark.id}`, {}, [
              N(`detail-remark-${remark.id}-content`, {}, [remark.content]),
              N(`detail-remark-${remark.id}-footer`, { class: "flex items-center justify-between" }, [N(`detail-remark-${remark.id}-time`, { class: "text-w-fg-1 text-[12px]" }, [window.DevboardHelpers.format_time(remark.created_at)]), Button(`detail-remark-${remark.id}-delete`, "删除", () => model.remove_remark(remark), { size: "sm" })]),
            ]) }),
          ]),
          N("detail-add-remark", { class: "mt-2" }, [Button("detail-add-remark-action", "添加", () => model.add_remark(), { size: "sm" })]),
        ]),
      ]),
    ]),
  ]);
}

function DetailView(model) {
  return Shell(model, N("detail-page", { class: "relative w-full h-full bg-w-bg-0" }, [
    Show({ when: model.state.detail, ok: () => DetailContent(model, model.state.detail.value), else: () => N("detail-loading", { class: "w-full h-full flex items-center justify-center text-w-fg-1" }, [Icon("detail-loading-icon", "loader", "w-6 h-6 animate-spin")]) }),
  ]));
}

function SettingField(model, name, label, path, options = {}) {
  const checkbox = options.type === "checkbox";
  const value = computed(model.state.settings, () => String(model.setting(path)));
  const checked = computed(model.state.settings, () => Boolean(model.setting(path)));
  const input = Input(`${name}-input`, value, checkbox ? undefined : (event) => model.update_setting(path, event), {
    type: options.type || "text",
    checked: checkbox ? checked : undefined,
    placeholder: options.placeholder,
    label,
    class: options.multiline ? "h-20" : "",
    onChange: checkbox ? (event) => { model.update_setting(path, event, true); model.save_settings(); } : undefined,
    onBlur: checkbox ? undefined : () => model.save_settings(),
  });
  return N(`${name}-field`, { class: checkbox ? "flex items-center justify-between" : "space-y-1" }, [N(`${name}-label`, { class: "text-w-fg-0" }, [label]), input]);
}

function GeneralSettings(model) {
  return N("settings-general", { class: "p-4 h-full overflow-y-auto scroll--hidden" }, [
    N("settings-general-title", { class: "text-2xl text-w-fg-0" }, ["配置"]),
    N("settings-general-fields", { class: "mt-4 space-y-8" }, [
      SettingField(model, "settings-autostart", "开机启动", "auto_start", { type: "checkbox" }),
      N("settings-douyin-group", { class: "space-y-2" }, [N("settings-douyin-title", { class: "text-w-fg-1" }, ["抖音"]), SettingField(model, "settings-douyin-cookie", "Cookie", "douyin.cookie")]),
      N("settings-paste-group", { class: "space-y-2" }, [N("settings-paste-title", { class: "text-w-fg-1" }, ["粘贴事件"]), SettingField(model, "settings-callback", "回调地址", "paste_event.callback_endpoint")]),
    ]),
  ]);
}

function ShortcutSettings(model) {
  return N("settings-shortcut", { class: "p-4 h-full overflow-y-auto scroll--hidden" }, [
    N("settings-shortcut-title", { class: "text-2xl text-w-fg-0" }, ["快捷键"]),
    N("settings-shortcut-row", { class: "mt-4 flex items-center justify-between" }, [
      N("settings-shortcut-label", {}, ["展示主面板"]),
      N("settings-shortcut-recorder", { class: "flex items-center h-[32px]" }, [Input("settings-shortcut-input", computed(model.state.settings, () => String(model.setting("shortcut.toggle_main_window_visible"))), (event) => model.update_setting("shortcut.toggle_main_window_visible", event), { class: "w-[220px] h-8 rounded-md", placeholder: "点击录制", onBlur: () => model.save_settings() })]),
    ]),
  ]);
}

function CategorySettings(model) {
  return N("settings-category", { class: "p-4 h-full overflow-y-auto scroll--hidden" }, [
    N("settings-category-header", { class: "flex items-center justify-between" }, [N("settings-category-title", { class: "text-2xl" }, ["标签"]), Button("settings-category-create", "创建", () => model.create_settings_category(), { size: "sm", icon: "plus" })]),
    N("settings-category-input-wrap", { class: "mt-4" }, [Input("settings-category-input", model.state.new_category_label, (event) => model.set_new_category_label(event), { placeholder: "新标签名称", onKeyDown: (event) => event.key === "Enter" && model.create_settings_category() })]),
    N("settings-category-tree", { class: "mt-4 space-y-1" }, [
      For({ each: model.state.categories, key: "id", render: (category) => N(`settings-category-${category.id}`, { class: "flex items-center py-2 px-3 rounded-md hover:bg-w-fg-4", style: { "padding-left": `${12 + (category.depth || 0) * 20}px` } }, [Icon(`settings-category-${category.id}-icon`, "folder", "w-4 h-4 mr-2 text-w-fg-1"), N(`settings-category-${category.id}-label`, {}, [category.label])]) }),
    ]),
  ]);
}

function SynchronizationSettings(model) {
  return N("settings-synchronization", { class: "p-4 h-full overflow-y-auto scroll--hidden" }, [
    N("settings-data-section", {}, [
      N("settings-data-title", { class: "text-2xl" }, ["数据"]),
      N("settings-data-fields", { class: "mt-4 space-y-2" }, [For({ each: model.state.database_fields, key: "key", render: (field) => N(`settings-data-${field.key}`, { class: "field flex items-center justify-between text-w-fg-0 cursor-pointer" }, [N(`settings-data-${field.key}-label`, {}, [field.label]), N(`settings-data-${field.key}-value`, { class: "flex items-center gap-1", onClick: () => model.reveal_file(field.text) }, [N(`settings-data-${field.key}-text`, {}, [field.text]), Icon(`settings-data-${field.key}-icon`, "folder", "w-4 h-4 text-w-fg-0")])]) })]),
    ]),
    N("settings-webdav-section", { class: "mt-8" }, [
      N("settings-webdav-title", { class: "text-2xl" }, ["Webdav"]),
      N("settings-webdav-fields", { class: "mt-4 space-y-2" }, [
        SettingField(model, "settings-webdav-url", "地址", "synchronize.webdav.url"),
        SettingField(model, "settings-webdav-username", "用户名", "synchronize.webdav.username"),
        SettingField(model, "settings-webdav-password", "密码", "synchronize.webdav.password", { type: "password" }),
        SettingField(model, "settings-webdav-root", "同步到该文件夹", "synchronize.webdav.root_dir"),
      ]),
      N("settings-webdav-actions", { class: "mt-4 flex items-center space-x-1" }, [Button("settings-webdav-ping", "测试并保存", () => model.sync("ping")), Button("settings-webdav-sync", "同步", () => model.sync("download")), Button("settings-webdav-upload", "推送", () => model.sync("upload"), { variant: "outline" })]),
    ]),
  ]);
}

function SystemSettings(model) {
  const info = model.state.system_info.value || {};
  const section = (name, title, fields) => N(name, {}, [N(`${name}-title`, { class: "text-2xl" }, [title]), ...fields.map((field) => N(`${name}-${field.key}`, { class: "field flex items-center justify-between py-2 text-w-fg-0" }, [N(`${name}-${field.key}-label`, {}, [field.label]), N(`${name}-${field.key}-value`, {}, [field.text])]))]);
  return N("settings-system", { class: "p-4 h-full overflow-y-auto scroll--hidden" }, [N("settings-system-sections", { class: "space-y-4" }, [section("settings-device-info", "本机信息", info.device || []), section("settings-app-info", "应用信息", info.app || [])])]);
}

function SettingsPanel(model) {
  return N("settings-panel", { class: "relative flex-1 w-0 h-full overflow-hidden" }, [
    Show({ when: computed(model.state.settings_page, (page) => page === "/user_settings"), ok: () => GeneralSettings(model) }),
    Show({ when: computed(model.state.settings_page, (page) => page === "/shortcut"), ok: () => ShortcutSettings(model) }),
    Show({ when: computed(model.state.settings_page, (page) => page === "/category"), ok: () => CategorySettings(model) }),
    Show({ when: computed(model.state.settings_page, (page) => page === "/settings_synchronization"), ok: () => SynchronizationSettings(model) }),
    Show({ when: computed(model.state.settings_page, (page) => page === "/settings_system"), ok: () => SystemSettings(model) }),
  ]);
}

function SettingsContent(model) {
  const menus = [["/user_settings", "配置"], ["/shortcut", "快捷键"], ["/category", "标签"], ["/settings_synchronization", "同步"], ["/settings_system", "关于"]];
  return N("settings-layout", { class: "flex w-full h-full" }, [
    N("settings-navigation", { class: "p-2 w-[120px] h-full border-r border-w-fg-3 bg-w-bg-1", attributes: { "aria-label": "设置页面" } }, [N("settings-navigation-items", { class: "space-y-1" }, menus.map(([path, label]) => N(`settings-navigation-${path.slice(1)}`, { class: computed(model.state.settings_page, (page) => `px-4 py-2 rounded-md cursor-pointer hover:bg-w-fg-4 ${page === path ? "bg-w-fg-4" : ""}`), onClick: () => model.navigate_settings(path) }, [label])))]),
    SettingsPanel(model),
  ]);
}

function SettingsView(model) {
  return Shell(model, N("settings-page", { class: "w-full h-full bg-w-bg-0" }, [Show({ when: model.state.settings, ok: () => SettingsContent(model), else: () => N("settings-loading", { class: "w-full h-full flex items-center justify-center text-w-fg-1" }, [Icon("settings-loading-icon", "loader", "w-6 h-6 animate-spin")]) })]));
}

function MediaView(model) {
  const file_path = model.query.get("f") || "";
  const source = model.file_url(file_path);
  if (model.route === "/video_preview") return Shell(model, N("video-preview-page", { class: "relative w-full h-full bg-black flex items-center justify-center" }, [Video({ src: source, controls: true, autoplay: true, loop: true, class: "max-w-full max-h-full", attributes: { n: "video-preview" } })]));
  if (model.route === "/pdf_preview") return Shell(model, N("pdf-preview-page", { class: "w-full h-full" }, [Webview({ href: source, class: "w-full h-full border-0 bg-white", attributes: { n: "pdf-preview", title: "PDF" } })]));
  return Shell(model, N("image-preview-page", { class: "relative w-full h-full" }, [Img({ src: source, alt: "文件预览", class: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full", attributes: { n: "image-preview" } })]));
}

function ShortcutKey(name, keys, separator = "+") {
  const children = [];
  keys.forEach((key, index) => {
    children.push(N(`${name}-${index}`, { class: "inline-flex items-center justify-center min-w-[36px] h-8 px-2 text-sm font-semibold border rounded-lg shadow-sm text-gray-700 bg-gray-50 border-gray-200" }, [key]));
    if (index < keys.length - 1) children.push(N(`${name}-${index}-separator`, { class: "text-gray-400 text-sm" }, [separator]));
  });
  return N(name, { class: "inline-flex items-center space-x-1" }, children);
}

function ShortcutSection(name, title, rows) {
  return N(name, { class: "shortcut-section" }, [
    N(`${name}-title`, { class: "text-2xl font-semibold border-b border-gray-200 pb-3 mb-6" }, [title]),
    N(`${name}-table`, { class: "w-full" }, [
      N(`${name}-head`, { class: "flex" }, [N(`${name}-head-key`, { class: "p-2 w-[280px]" }, ["快捷键"]), N(`${name}-head-description`, { class: "p-2" }, ["说明"])]),
      ...rows.map((row, index) => N(`${name}-row-${index}`, { class: "flex" }, [N(`${name}-row-${index}-key`, { class: "p-2 w-[280px] flex gap-2" }, row.keys.map((keys, key_index) => ShortcutKey(`${name}-row-${index}-key-${key_index}`, keys))), N(`${name}-row-${index}-description`, { class: "p-2" }, [row.description])])),
    ]),
  ]);
}

function HelpView(model) {
  return Shell(model, N("helper-layout", { class: "flex w-full h-full" }, [
    N("helper-navigation", { class: "p-2 w-[120px] h-full border-r border-w-fg-3 bg-w-bg-1" }, [N("helper-navigation-items", { class: "space-y-1" }, [N("helper-navigation-shortcut", { class: "px-4 py-2 rounded-md cursor-pointer bg-w-fg-4" }, ["快捷键"])])]),
    N("helper-shortcuts", { class: "flex-1 w-0 h-full overflow-y-auto p-4 space-y-8 scroll--hidden" }, [
      N("helper-shortcuts-header", { class: "mb-10" }, [N("helper-shortcuts-title", { class: "text-4xl font-bold mb-2" }, ["快捷键说明"])]),
      ShortcutSection("helper-window-shortcuts", "窗口控制", [
        { keys: [["自定义"]], description: "macOS 端唤起主窗口" },
        { keys: [["Ctrl", ","]], description: "打开设置窗口" },
        { keys: [["Ctrl", "Q"]], description: "退出应用" },
      ]),
      ShortcutSection("helper-content-shortcuts", "内容选择与操作", [
        { keys: [["↑"], ["K"]], description: "选择上一条记录" },
        { keys: [["↓"], ["J"]], description: "选择下一条记录" },
        { keys: [["Ctrl", "U"]], description: "快速往上移动" },
        { keys: [["Ctrl", "D"]], description: "快速往下移动" },
        { keys: [["GG"]], description: "快速定位到第一条记录" },
        { keys: [["Space"]], description: "预览选择的记录" },
        { keys: [["YY"], ["Enter"]], description: "将记录复制到粘贴板" },
        { keys: [["Shift", "Backspace"]], description: "删除选择的记录" },
      ]),
      ShortcutSection("helper-search-shortcuts", "搜索", [
        { keys: [["Ctrl", "F"], ["O"]], description: "聚焦到搜索框" },
        { keys: [["Shift", "3"]], description: "搜索框为空时聚焦并展示标签" },
        { keys: [["Esc"]], description: "搜索框失焦" },
      ]),
    ]),
  ]));
}

function DebugView(model) {
  return Shell(model, N("debug-page", { class: "p-4 w-full h-full overflow-y-auto" }, [N("debug-form", { class: "space-y-4" }, [Textarea("debug-text", model.state.debug_text, (event) => model.set_debug_text(event), { label: "模拟粘贴内容" }), N("debug-actions", {}, [Button("debug-create", "创建", () => model.create_mock_paste())])])]));
}

function AccountUnavailableView(model, mode) {
  const login = mode === "login";
  return Shell(model, N(`${mode}-page`, { class: "pt-12 px-4 h-w-screen max-w-md mx-auto" }, [
    N(`${mode}-brand`, { class: "h-[160px] mx-auto" }, [N(`${mode}-brand-inner`, { class: "relative cursor-pointer" }, [N(`${mode}-brand-title`, { class: "z-20 relative text-6xl text-center italic" }, ["Fit Hub"])])]),
    N(`${mode}-unavailable`, { class: "space-y-4 rounded-md text-w-fg-0" }, [N(`${mode}-title`, { class: "text-2xl text-center" }, [login ? "登录" : "注册"]), N(`${mode}-description`, { class: "text-center text-w-fg-1" }, ["当前本地版未启用账户服务。"]) ]),
    N(`${mode}-actions`, { class: "w-full mt-8" }, [Button(`${mode}-home`, "前往首页", () => model.navigate("/home/index"), { class: "w-full" })]),
  ]));
}

function NotFoundView(model) {
  return Shell(model, N("not-found-page", { class: "p-4" }, [N("not-found-text", {}, ["Not Found"])]));
}

function ErrorView(model) {
  return Shell(model, N("error-page", { class: "p-4" }, [N("error-content", { class: "text-center" }, [N("error-title", { class: "text-xl" }, [model.query.get("title") || "发生错误"]), N("error-description", { class: "mt-4" }, [model.query.get("desc") || "未知错误"])])]));
}

export function ApplicationView(model) {
  if (model.route === "/preview") return DetailView(model);
  if (["/settings", "/user_settings", "/shortcut", "/category", "/settings_synchronization", "/settings_system"].includes(model.route)) return SettingsView(model);
  if (["/image_preview", "/video_preview", "/pdf_preview"].includes(model.route)) return MediaView(model);
  if (["/helper_center", "/help/shortcut"].includes(model.route)) return HelpView(model);
  if (model.route === "/debug_console") return DebugView(model);
  if (model.route === "/login") return AccountUnavailableView(model, "login");
  if (model.route === "/register") return AccountUnavailableView(model, "register");
  if (model.route === "/notfound") return NotFoundView(model);
  if (model.route === "/error") return ErrorView(model);
  if (["/", "/home", "/home/index"].includes(model.route)) return HomeView(model);
  return NotFoundView(model);
}
