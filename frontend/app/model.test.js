import test from "node:test";
import assert from "node:assert/strict";
import { AppModel, format_time, is_settings_route, parse_files, summarize_record } from "./model.js";

test("clipboard presentation helpers", () => {
  assert.equal(parse_files('[{"name":"a.txt"}]')[0].name, "a.txt");
  assert.equal(summarize_record({ content_type: "file", file_list_json: '[{"name":"a.txt"}]' }), "a.txt");
  assert.notEqual(format_time("bad"), "Invalid Date");
});

test("home keyboard selects, previews, and copies the active record", () => {
  const ref = (value) => ({ value, as(next) { this.value = next; } });
  global.window = { Timeless: { ref, refarr: ref }, location: { reload() {} } };
  const model = new AppModel({ pathname: "/home/index", search: "" });
  model.state.records.as([{ id: "first" }, { id: "second" }]);
  const actions = [];
  model.open_detail = (record) => actions.push(["preview", record.id]);
  model.copy = (record) => actions.push(["copy", record.id]);
  const keydown = (code, target = { tagName: "DIV" }) => model.handle_keydown({ code, key: code, target, preventDefault() {} });

  keydown("KeyJ");
  assert.equal(model.active_record().id, "second");
  keydown("Space");
  keydown("Enter");
  keydown("KeyK");
  keydown("KeyJ", { tagName: "INPUT" });

  assert.equal(model.active_record().id, "first");
  assert.deepEqual(actions, [["preview", "second"], ["copy", "second"]]);
});

test("window shortcuts quit, reload, and hide", () => {
  const ref = (value) => ({ value, as(next) { this.value = next; } });
  let reloaded = false;
  global.window = { Timeless: { ref, refarr: ref }, location: { reload() { reloaded = true; } } };
  const model = new AppModel({ pathname: "/home/index", search: "" });
  const actions = [];
  model.quit_app = () => actions.push("quit");
  model.hide_window = () => actions.push("hide");
  const event = (key, extra = {}) => ({ key, code: key, target: { tagName: "DIV" }, preventDefault() {}, ...extra });

  model.handle_keydown(event("q", { metaKey: true }));
  model.handle_keydown(event("r", { ctrlKey: true }));
  model.handle_keydown(event("Escape"));
  model.handle_keydown(event("Escape"));

  assert.deepEqual(actions, ["quit", "hide"]);
  assert.equal(reloaded, true);
});

test("settings replace the registered shortcut", async () => {
  const ref = (value) => ({ value, as(next) { this.value = next; } });
  global.window = { Timeless: { ref, refarr: ref }, clearTimeout() {}, setTimeout() { return 1; } };
  const model = new AppModel({ pathname: "/settings_system", search: "" });
  model.state.settings.as({ shortcut: { toggle_main_window_visible: "Ctrl+2" } });
  model.loaded_shortcut = "Ctrl+1";
  const calls = [];
  model.call = async (path, body) => calls.push([path, body]);
  await model.save_settings();
  assert.deepEqual(calls.slice(-2).map(([path]) => path), ["/api/common/shortcut/unregister", "/api/common/shortcut/register"]);
});

test("media routes do not load clipboard data", async () => {
  const ref = (value) => ({ value, as(next) { this.value = next; } });
  global.window = { Timeless: { ref, refarr: ref } };
  const model = new AppModel({ pathname: "/pdf_preview", search: "?f=manual.pdf" });
  model.load_records = () => assert.fail("clipboard data should not load");
  await model.start();
});

test("settings navigation stays inside the settings window", () => {
  const ref = (value) => ({ value, as(next) { this.value = next; } });
  let pathname = "";
  global.window = { Timeless: { ref, refarr: ref }, history: { replaceState(_state, _title, path) { pathname = path; } } };
  const model = new AppModel({ pathname: "/settings", search: "" });
  model.navigate_settings("/category");
  assert.equal(model.state.settings_page.value, "/category");
  assert.equal(pathname, "/category");
  assert.equal(is_settings_route("/settings_synchronization"), true);
});

test("remaining standalone pages do not load clipboard data", async () => {
  const ref = (value) => ({ value, as(next) { this.value = next; } });
  global.window = { Timeless: { ref, refarr: ref } };
  for (const pathname of ["/help/shortcut", "/debug_console", "/login", "/register", "/notfound", "/unknown"]) {
    const model = new AppModel({ pathname, search: "" });
    model.load_records = () => assert.fail(`clipboard data should not load for ${pathname}`);
    await model.start();
  }
});

test("debug page creates a mock clipboard record", async () => {
  const ref = (value) => ({ value, as(next) { this.value = next; } });
  global.window = { Timeless: { ref, refarr: ref }, clearTimeout() {}, setTimeout() { return 1; } };
  const model = new AppModel({ pathname: "/debug_console", search: "" });
  model.state.debug_text.as("example");
  const calls = [];
  model.call = async (path, body) => {
    calls.push([path, body]);
    return { id: "mock" };
  };
  await model.create_mock_paste();
  assert.deepEqual(calls, [["/api/paste/mock", { text: "example" }]]);
  assert.equal(model.state.debug_text.value, "");
});
