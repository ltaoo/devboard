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
import { MutableRecord, Unpacked } from "@/types";
import { parseJSONStr } from "@/utils";

export function fetchPasteEventList(body: Partial<FetchParams> & Partial<{ types: string[]; keyword: string }>) {
  return request.post<
    ListResponse<{
      id: string;
      content_type: PasteContentType;
      text: string;
      image_base64: string;
      file_list_json: string;
      html: string;
      details: string;
      created_at: string;
      last_modified_time: string;
      categories: {
        id: string;
        label: string;
      }[];
    }>
  >(FetchPasteEventList, body);
}

export enum PasteContentType {
  Text = "text",
  HTML = "html",
  Image = "image",
  File = "file",
}
export type PasteContentText = {};
export type PasteContentHTML = {};
export type PasteContentImage = {
  width: number;
  height: number;
  size: number;
  size_for_humans: string;
};
export type PasteContentFile = {};
export type PasteContentDetails = MutableRecord<{
  [PasteContentType.Text]: PasteContentText;
  [PasteContentType.HTML]: PasteContentHTML;
  [PasteContentType.Image]: PasteContentImage;
  [PasteContentType.File]: PasteContentFile;
}>;

export function processPartialPasteEvent(
  v: UnpackedRequestPayload<ReturnType<typeof fetchPasteEventList>>["list"][number]
) {
  const categories = (v.categories ?? []).map((cate) => cate.label);
  const text = (() => {
    const tt = v.text;
    if (v.content_type === PasteContentType.HTML) {
      // 旧数据错误地写入了 text 字段，前端做个兼容？
      return v.html || tt;
    }
    if (categories.includes("time")) {
      const dt = (() => {
        if (tt.match(/^[0-9]{1,}$/)) {
          return dayjs(tt.length === 10 ? Number(tt) * 1000 : Number(tt));
        }
        // if (tt.match(/\+[0-9]{2}/)) {
        // }
        return dayjs(tt);
      })();
      return dt.format(tt.length === 10 ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD HH:mm:ss");
    }
    return tt;
  })();
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
  const details = (() => {
    if (v.details) {
      const r = parseJSONStr<unknown>(v.details);
      if (r.error) {
        return null;
      }
      return {
        type: v.content_type,
        data: r.data,
      } as PasteContentDetails;
    }
    return null;
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
    details,
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
        if (categories.includes(PasteContentType.Image) && details) {
          const d = details.data as PasteContentImage;
          if (d.height) {
            return d.height;
          }
        }
        if (categories.includes("text")) {
          const line_count = text.length / 32;
          let height = 6 + line_count * 32 + 6;
          if (height > 76) {
            return 76;
          }
          return height;
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
      return 92 + estimated__content_height - base_content_height;
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
    content_type: PasteContentType;
    text: string;
    image_base64: string;
    file_list_json: string;
    html: string;
    details: string;
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
