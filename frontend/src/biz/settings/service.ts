import { Read, UpdateSettingsByPath, WriteConfig } from "~/configservice";
import { UpdateAutoStart } from "~/systemservice";
import { RegisterShortcut, UnregisterShortcut } from "~/commonservice";

import { request } from "@/biz/requests";

type UserSettings = {
  douyin: {
    cookie: string;
  };
  shortcut: {
    toggle_main_window_visible: string;
    disable_watch_clipboard: string;
    enable_watch_clipboard: string;
  };
  ignore: {
    max_length: number;
    filename: string[];
    extension: string[];
    apps: string[];
  };
  paste_event: {
    callback_endpoint: string;
    /** 事件忽略的规则 */
    ignore_rules: {
      /** 指定文件名 */
      filename: string[];
      /** 指定后缀 */
      extension: string[];
      /** 最大长度 */
      max_length: number;
      /** 指定应用内 */
      apps: string[];
    };
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

export function toggleAutoStart(body: { auto_start: boolean }) {
  return request.post(UpdateAutoStart, body);
}
