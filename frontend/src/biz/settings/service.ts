import { Read, WriteConfig } from "~/configservice";

import { request } from "@/biz/requests";

type UserSettings = {
  douyin: {
    cookie: string;
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
