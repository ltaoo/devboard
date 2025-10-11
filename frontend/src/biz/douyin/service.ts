import dayjs from "dayjs";

import { DownloadDouyinVideo } from "~/douyinservice";

import { FetchParams } from "@/domains/list/typing";
import { request } from "@/biz/requests";
import { ListResponse } from "@/biz/requests/types";
import { TmpRequestResp, UnpackedRequestPayload } from "@/domains/request/utils";
import { Result } from "@/domains/result";
import { Unpacked } from "@/types";
import { parseJSONStr } from "@/utils";

export function downloadDouyinVideo(body: { content: string }) {
  return request.post<{}>(DownloadDouyinVideo, body);
}
