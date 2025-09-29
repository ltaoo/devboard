import { ExportRecordList, ImportFileList, PingWebDav } from "~/syncservice";

import { request } from "@/biz/requests";

export function pingWebDav(body: { url: string; username: string; password: string }) {
  return request.post<{ ok: boolean }>(PingWebDav, body);
}

export function exportRecordListToFileList(body: {
  url: string;
  username: string;
  password: string;
  root_dir: string;
}) {
  return request.post<void>(ExportRecordList, body);
}

export function importFileListToRecordList() {
  return request.post<void>(ImportFileList);
}
