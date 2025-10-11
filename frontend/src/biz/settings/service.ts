import { Read, WriteConfig } from "~/configservice";

import { request } from "@/biz/requests";

export function fetchUserSettings() {
  return request.post<{
    douyin: {
      cookie: string;
    };
  }>(Read);
}

export function updateUserSettings(body: Record<string, unknown>) {
  return request.post<{
    douyin: {
      cookie: string;
    };
  }>(WriteConfig, body);
}
