import { OpenFileDialog, OpenPreviewWindow } from "~/fileservice";

import { request } from "@/biz/requests";
import { BizResponse } from "@/biz/requests/types";

type FileResp = {
  name: string;
  full_path: string;
  size: number;
  mine_type: string;
  created_at: number;
};

export function openFileDialog() {
  return request.post<{ files: FileResp[]; errors: string[]; cancel: boolean }>(OpenFileDialog);
}

export function openFilePreview(body: { mime_type: string; filepath: string }) {
  return request.post<void>(OpenPreviewWindow, body);
}
