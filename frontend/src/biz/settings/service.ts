import { Read, UpdateSettingsByPath, WriteConfig } from "~/configservice";

import { request } from "@/biz/requests";
import { RegisterShortcut, UnregisterShortcut } from "~/commonservice";

type UserSettings = {
  douyin: {
    cookie: string;
  };
  shortcut: {
    toggle_main_window_visible: string;
    disable_watch_clipboard: string;
    enable_watch_clipboard: string;
  };
  paste_event: {
    callback_endpoint: string;
  };
  synchronize: {
    webdav: {
      url: string;
      username: string;
      password: string;
      root_dir: string;
    };
  };
};

export function fetchUserSettings() {
  return request.post<UserSettings>(Read);
}

export function updateUserSettings(body: Partial<UserSettings>) {
  return request.post<UserSettings>(WriteConfig, body);
}
export function updateUserSettingsWithPath(body: { path: string; value: unknown }) {
  return request.post<UserSettings>(UpdateSettingsByPath, body);
}

export function registerShortcut(body: { shortcut: string; command: string }) {
  return request.post(RegisterShortcut, body);
}

export function unregisterShortcut(body: { shortcut: string }) {
  return request.post(UnregisterShortcut, body);
}
