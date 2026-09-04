const el = (id) => document.getElementById(id);

let state = null;
let selectedId = "";

const refs = {
  deviceSubtitle: el("deviceSubtitle"),
  refreshBtn: el("refreshBtn"),
  syncBtn: el("syncBtn"),
  remoteKind: el("remoteKind"),
  rootDir: el("rootDir"),
  webdavUrl: el("webdavUrl"),
  webdavUser: el("webdavUser"),
  webdavPass: el("webdavPass"),
  gitRepo: el("gitRepo"),
  gitPush: el("gitPush"),
  saveConfigBtn: el("saveConfigBtn"),
  manifestBtn: el("manifestBtn"),
  createText: el("createText"),
  createBtn: el("createBtn"),
  recordList: el("recordList"),
  metricCheckpoint: el("metricCheckpoint"),
  metricRecords: el("metricRecords"),
  metricDraft: el("metricDraft"),
  metricDeleted: el("metricDeleted"),
  selectedMeta: el("selectedMeta"),
  editText: el("editText"),
  updateBtn: el("updateBtn"),
  deleteBtn: el("deleteBtn"),
  clearSelectionBtn: el("clearSelectionBtn"),
  pullBtn: el("pullBtn"),
  pushBtn: el("pushBtn"),
  fullSyncBtn: el("fullSyncBtn"),
  statusLine: el("statusLine"),
  manifestView: el("manifestView"),
  logView: el("logView"),
};

function api(path, options) {
  const opts = options || {};
  return invoke(path, {
    method: opts.method || "GET",
    args: opts.args || {},
  }).then((res) => {
    if (!res || res.code !== 0) {
      throw new Error((res && (res.msg || res.message)) || "request failed");
    }
    return res.data;
  });
}

function setStatus(text, isError) {
  refs.statusLine.textContent = text;
  refs.statusLine.classList.toggle("error", !!isError);
}

function remoteConfigFromForm() {
  return {
    kind: refs.remoteKind.value,
    root_dir: refs.rootDir.value.trim() || "/devboard-smoke-test",
    webdav_url: refs.webdavUrl.value.trim(),
    webdav_username: refs.webdavUser.value,
    webdav_password: refs.webdavPass.value,
    git_repo: refs.gitRepo.value.trim(),
    git_push: refs.gitPush.checked,
  };
}

function fillConfig(remote) {
  const cfg = remote || {};
  refs.remoteKind.value = cfg.kind || "webdav";
  refs.rootDir.value = cfg.root_dir || "/devboard-smoke-test";
  refs.webdavUrl.value = cfg.webdav_url || "";
  refs.webdavUser.value = cfg.webdav_username || "";
  refs.webdavPass.value = cfg.webdav_password || "";
  refs.gitRepo.value = cfg.git_repo || "";
  refs.gitPush.checked = cfg.git_push !== false;
  updateRemoteFields();
}

function updateRemoteFields() {
  const kind = refs.remoteKind.value;
  document.querySelectorAll(".webdav-field").forEach((node) => {
    node.style.display = kind === "webdav" ? "" : "none";
  });
  document.querySelectorAll(".git-field").forEach((node) => {
    node.style.display = kind === "git" ? "" : "none";
  });
}

function render(nextState) {
  state = nextState || state;
  if (!state) return;

  refs.deviceSubtitle.textContent =
    "Device " + state.device_id + " · " + state.remote.kind + " · " + (state.remote.root_dir || "");
  refs.metricCheckpoint.textContent = String(state.checkpoint || 0);

  const records = state.records || [];
  const visible = records.filter((item) => !item.deleted_at);
  const draft = records.filter((item) => item.sync_status === 1);
  const deleted = records.filter((item) => !!item.deleted_at);

  refs.metricRecords.textContent = String(visible.length);
  refs.metricDraft.textContent = String(draft.length);
  refs.metricDeleted.textContent = String(deleted.length);

  renderRecords(records);
  renderSelected();
  renderLogs(state.logs || []);
}

function renderRecords(records) {
  refs.recordList.innerHTML = "";
  const ordered = records.slice().sort((a, b) => {
    return String(b.last_operation_time || "").localeCompare(String(a.last_operation_time || ""));
  });
  if (ordered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "selected-meta";
    empty.textContent = "No local records";
    refs.recordList.appendChild(empty);
    return;
  }
  ordered.forEach((record) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "record-row";
    if (record.id === selectedId) row.classList.add("selected");
    if (record.deleted_at) row.classList.add("deleted");
    row.addEventListener("click", () => {
      selectedId = record.id;
      render(state);
    });

    const text = document.createElement("div");
    text.className = "record-text";
    text.textContent = record.text || "(empty)";
    row.appendChild(text);

    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.appendChild(badge(record.id));
    meta.appendChild(badge(record.sync_status === 1 ? "draft" : "synced", record.sync_status === 1 ? "draft" : ""));
    if (record.deleted_at) meta.appendChild(badge("deleted", "deleted"));
    row.appendChild(meta);
    refs.recordList.appendChild(row);
  });
}

function badge(text, className) {
  const node = document.createElement("span");
  node.className = "badge" + (className ? " " + className : "");
  node.textContent = text;
  return node;
}

function selectedRecord() {
  if (!state || !selectedId) return null;
  return (state.records || []).find((item) => item.id === selectedId) || null;
}

function renderSelected() {
  const record = selectedRecord();
  const hasRecord = !!record;
  refs.updateBtn.disabled = !hasRecord || !!record.deleted_at;
  refs.deleteBtn.disabled = !hasRecord || !!record.deleted_at;
  refs.editText.disabled = !hasRecord || !!record.deleted_at;
  if (!record) {
    refs.selectedMeta.textContent = "No record selected";
    refs.editText.value = "";
    return;
  }
  refs.selectedMeta.textContent =
    record.id +
    " · " +
    (record.sync_status === 1 ? "draft" : "synced") +
    (record.deleted_at ? " · deleted" : "");
  refs.editText.value = record.text || "";
}

function renderLogs(logs) {
  refs.logView.innerHTML = "";
  if (!logs.length) {
    refs.logView.textContent = "(no activity)";
    return;
  }
  logs.slice().reverse().forEach((line) => {
    const node = document.createElement("div");
    node.className = "log-line";
    node.textContent = line;
    refs.logView.appendChild(node);
  });
}

function refresh() {
  return api("/api/state").then((data) => {
    fillConfig(data.remote);
    render(data);
    setStatus("Ready", false);
  });
}

function saveConfig() {
  return api("/api/config", {
    method: "POST",
    args: remoteConfigFromForm(),
  }).then((data) => {
    render(data);
    setStatus("Config saved", false);
  });
}

function createRecord() {
  const text = refs.createText.value.trim();
  if (!text) {
    setStatus("Enter text before creating a record", true);
    return Promise.resolve();
  }
  return api("/api/record/create", {
    method: "POST",
    args: { text },
  }).then((data) => {
    refs.createText.value = "";
    render(data.state);
    selectedId = data.record.id;
    render(state);
    setStatus("Created " + data.record.id, false);
  });
}

function updateRecord() {
  const record = selectedRecord();
  if (!record) return Promise.resolve();
  return api("/api/record/update", {
    method: "POST",
    args: { id: record.id, text: refs.editText.value },
  }).then((data) => {
    render(data);
    setStatus("Updated " + record.id, false);
  });
}

function deleteRecord() {
  const record = selectedRecord();
  if (!record) return Promise.resolve();
  return api("/api/record/delete", {
    method: "POST",
    args: { id: record.id },
  }).then((data) => {
    render(data);
    setStatus("Deleted " + record.id, false);
  });
}

function runSync(path, label) {
  setBusy(true);
  setStatus(label + " running", false);
  return api(path, { method: "POST" })
    .then((data) => {
      if (data.records) {
        state.records = data.records;
        state.checkpoint = data.checkpoint;
        state.logs = data.logs || state.logs;
        render(state);
      }
      if (data.manifest) {
        refs.manifestView.textContent = JSON.stringify(data.manifest, null, 2);
      }
      const result = data.result || {};
      setStatus(
        label +
          " complete · tasks " +
          ((result.record_tasks && result.record_tasks.length) || 0) +
          " · files " +
          ((result.file_operations && result.file_operations.length) || 0),
        false,
      );
      return refresh();
    })
    .catch((err) => {
      setStatus(err.message, true);
      return refresh().catch(() => {});
    })
    .finally(() => setBusy(false));
}

function loadManifest() {
  setBusy(true);
  return api("/api/remote/manifest")
    .then((data) => {
      refs.manifestView.textContent = data.exists
        ? JSON.stringify(data.manifest, null, 2)
        : "(manifest not found)";
      setStatus(data.exists ? "Manifest loaded" : "Manifest not found", !data.exists);
    })
    .catch((err) => setStatus(err.message, true))
    .finally(() => setBusy(false));
}

function setBusy(busy) {
  [
    refs.refreshBtn,
    refs.syncBtn,
    refs.saveConfigBtn,
    refs.manifestBtn,
    refs.createBtn,
    refs.pullBtn,
    refs.pushBtn,
    refs.fullSyncBtn,
  ].forEach((button) => {
    button.disabled = busy;
  });
}

function bindEvents() {
  refs.remoteKind.addEventListener("change", updateRemoteFields);
  refs.refreshBtn.addEventListener("click", () => refresh());
  refs.saveConfigBtn.addEventListener("click", () => saveConfig().catch((err) => setStatus(err.message, true)));
  refs.createBtn.addEventListener("click", () => createRecord().catch((err) => setStatus(err.message, true)));
  refs.updateBtn.addEventListener("click", () => updateRecord().catch((err) => setStatus(err.message, true)));
  refs.deleteBtn.addEventListener("click", () => deleteRecord().catch((err) => setStatus(err.message, true)));
  refs.clearSelectionBtn.addEventListener("click", () => {
    selectedId = "";
    render(state);
  });
  refs.pullBtn.addEventListener("click", () => runSync("/api/sync/pull", "Pull"));
  refs.pushBtn.addEventListener("click", () => runSync("/api/sync/push", "Push"));
  refs.fullSyncBtn.addEventListener("click", () => runSync("/api/sync/full", "Sync"));
  refs.syncBtn.addEventListener("click", () => runSync("/api/sync/full", "Sync"));
  refs.manifestBtn.addEventListener("click", loadManifest);
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  refresh().catch((err) => setStatus(err.message, true));
});
