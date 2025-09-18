import dayjs from "dayjs";

import { FetchPasteEventList } from "~/pasteservice";

import { FetchParams } from "@/domains/list/typing";
import { request } from "@/biz/requests";
import { ListResponse } from "@/biz/requests/types";
import { TmpRequestResp } from "@/domains/request/utils";
import { Result } from "@/domains/result";

function text_content_detector(text: string) {
  if (text.match(/^https{0,1}:\/\//)) {
    return "url";
  }
  if (text.match(/^{[\s\n]{1,}"[a-zA-Z0-9]{1,}":/)) {
    return "json";
  }
  if (text.match(/^<[a-z]{1,}.{1,}>[\s\n]{0,}</)) {
    return "html";
  }
  //   if (text.match(/<[a-z]{1,}/)) {
  //     return "code";
  //   }
  return null;
}

export function fetchPasteEventList(body: Partial<FetchParams>) {
  return request.post<
    ListResponse<{
      id: number;
      content_type: string;
      content: {
        id: number;
        content_type: string;
        text: string;
      };
      created_at: string;
    }>
  >(FetchPasteEventList, {});
}
export function fetchPasteEventListProcess(r: TmpRequestResp<typeof fetchPasteEventList>) {
  if (r.error) {
    return Result.Err(r.error);
  }
  return Result.Ok({
    ...r.data,
    list: r.data.list.map((v) => {
      return {
        ...v,
        type: (() => {
          if (v.content_type === "text" && v.content.text) {
            const t = text_content_detector(v.content.text);
            if (t) {
              return t;
            }
          }
          return v.content_type;
        })(),
        created_at: dayjs(v.created_at),
      };
    }),
  });
}

export function openPreviewWindow(body: { id: number }) {
	// return request.open(OpenPreviewWindow, )
}
