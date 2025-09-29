import { ExportRecordList, ImportFileList } from "~/syncservice";

import { request } from "@/biz/requests";

export function exportRecordListToFileList() {
  return request.post<void>(ExportRecordList);
}

export function importFileListToRecordList() {
  return request.post<void>(ImportFileList);
}
