import { RemoteToLocal, LocalToRemote, PingWebDav, FetchDatabaseDirs } from "~/syncservice";

import { request } from "@/biz/requests";

export function fetchDatabaseDirs() {
  return request.post<{
    fields: {
      key: string;
      label: string;
      text: string;
    }[];
  }>(FetchDatabaseDirs, {});
}

export function pingWebDav(body: { url: string; username: string; password: string }) {
  return request.post<{ ok: boolean }>(PingWebDav, body);
}

export function syncToRemote(body: {
  url: string;
  username: string;
  password: string;
  root_dir: string;
  test?: boolean;
}) {
  return request.post<
    Record<
      string,
      {
        file_operations: {}[];
        file_tasks: {}[];
      }
    >
  >(LocalToRemote, body);
}

export function syncFromRemote(body: {
  url: string;
  username: string;
  password: string;
  root_dir: string;
  test?: boolean;
}) {
  return request.post<
    Record<
      string,
      {
        file_operations: {}[];
        file_tasks: {}[];
      }
    >
  >(RemoteToLocal, body);
}
