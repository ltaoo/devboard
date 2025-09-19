import { OpenFileDialog, OpenPreviewWindow, SaveFileTo } from "~/fileservice";

import { request } from "@/biz/requests";
import { BizResponse } from "@/biz/requests/types";
import { SaveFileToBody } from "~/models";

type FileResp = {
  name: string;
  full_path: string;
  size: number;
  mine_type: string;
  created_at: number;
};

export function openLocalFile() {
  return request.post<{ files: FileResp[]; errors: string[]; cancel: boolean }>(OpenFileDialog);
}

export function saveFileTo(body: { filename: string; content: string }) {
  return request.post<{}>(
    SaveFileTo,
    new SaveFileToBody({
      filename: body.filename,
      content: body.content,
    })
  );
}

export function openFilePreview(body: { mime_type: string; filepath: string }) {
  return request.post<void>(OpenPreviewWindow, body);
}
