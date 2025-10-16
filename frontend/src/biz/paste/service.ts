import dayjs from "dayjs";

import {
  DeletePasteEvent,
  FetchPasteEventList,
  FetchPasteEventProfile,
  MockPasteText,
  PreviewPasteEvent,
  Write,
} from "~/pasteservice";

import { FetchParams } from "@/domains/list/typing";
import { request } from "@/biz/requests";
import { ListResponse } from "@/biz/requests/types";
import { TmpRequestResp, UnpackedRequestPayload } from "@/domains/request/utils";
import { Result } from "@/domains/result";
import { Unpacked } from "@/types";
import { parseJSONStr } from "@/utils";

export function fetchPasteEventList(body: Partial<FetchParams> & Partial<{ types: string[]; keyword: string }>) {
  return request.post<
    ListResponse<{
      id: string;
      content_type: "text" | "image" | "file" | "html";
      text: string;
      image_base64: string;
      file_list_json: string;
      html: string;
      created_at: string;
      last_modified_time: string;
      categories: {
        id: string;
        label: string;
      }[];
    }>
  >(FetchPasteEventList, body);
}

export function processPartialPasteEvent(
  v: UnpackedRequestPayload<ReturnType<typeof fetchPasteEventList>>["list"][number]
) {
  const categories = (v.categories ?? []).map((cate) => cate.label);
  const files = (() => {
    if (v.file_list_json) {
      const r = parseJSONStr<
        {
          name: string;
          absolute_path: string;
          mime_type: string;
        }[]
      >(v.file_list_json);
      if (r.error) {
        return null;
      }
      return r.data;
    }
  })();
  const text = (() => {
    const tt = v.text;
    if (v.content_type === "html") {
      // 旧数据错误地写入了 text 字段，前端做个兼容？
      return v.html || tt;
    }
    if (categories.includes("time")) {
      const dt = dayjs(tt.length === 10 ? Number(tt) * 1000 : Number(tt));
      return dt.format(tt.length === 10 ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD HH:mm:ss");
    }
    return tt;
  })();
  return {
    ...v,
    origin_text: v.text,
    types: categories,
    text,
    language: (() => {
      if (categories.includes("code")) {
        return categories.filter((c) => c !== "code").join("/");
      }
      return null;
    })(),
    image_url: v.image_base64 ? `data:image/png;base64,${v.image_base64}` : null,
    operations: (() => {
      const r: string[] = [];
      if (v.text.includes("复制打开抖音")) {
        r.push("douyin_download");
      }
      if (v.text.match(/https:\/\/v\.douyin/)) {
        r.push("douyin_download");
      }
      if (v.text.match(/https:\/\/www\.douyin\.com\/video/)) {
        r.push("douyin_download");
      }
      if (categories.includes("JSON")) {
        r.push("json_download");
      }
      return r;
    })(),
    files,
    height: (() => {
      const base_content_height = 40;
      const estimated__content_height = (() => {
        if (categories.includes("text")) {
          if (text.length > 80) {
            return 112;
          }
        }
        if (categories.includes("code")) {
          const lines = text.split("\n");
          let height = lines.length * 16 + (lines.length - 1) * 2;
          if (height > 120) {
            height = 120;
          }
          return height;
        }
        return 40;
      })();
      return 94 + estimated__content_height - base_content_height;
    })(),
    type: v.content_type,
    created_at: dayjs(v.created_at),
    created_at_text: dayjs(v.created_at).format("YYYY-MM-DD HH:mm:ss"),
  };
}
export function fetchPasteEventListProcess(r: TmpRequestResp<typeof fetchPasteEventList>) {
  if (r.error) {
    return Result.Err(r.error);
  }
  return Result.Ok({
    ...r.data,
    list: r.data.list.map((v) => {
      return processPartialPasteEvent(v);
    }),
  });
}

export function fetchPasteEventProfile(body: { id: string }) {
  return request.post<{
    id: string;
    content_type: "text" | "image" | "file" | "html";
    text: string;
    image_base64: string;
    file_list_json: string;
    html: string;
    created_at: string;
    last_modified_time: string;
    categories: {
      id: string;
      label: string;
    }[];
  }>(FetchPasteEventProfile, { event_id: body.id });
}
export function fetchPasteEventProfileProcess(r: TmpRequestResp<typeof fetchPasteEventProfile>) {
  if (r.error) {
    return Result.Err(r.error);
  }
  const v = r.data;
  const vv = processPartialPasteEvent(v);
  return Result.Ok({
    ...v,
    ...vv,
  });
}

export function deletePasteEvent(body: { id: string }) {
  return request.post(DeletePasteEvent, { event_id: body.id });
}

export function openPasteEventPreviewWindow(body: { id: string }) {
  return request.post(PreviewPasteEvent, { event_id: body.id });
}

export function writePasteEvent(body: { id: string }) {
  return request.post(Write, { event_id: body.id });
}

export function fakePasteEvent(body: { text: string }) {
  return request.post(MockPasteText, { text: body.text });
}
