import dayjs from "dayjs";

import { DeletePasteEvent, FetchPasteEventList, FetchPasteEventProfile, PreviewPasteEvent } from "~/pasteservice";

import { FetchParams } from "@/domains/list/typing";
import { request } from "@/biz/requests";
import { ListResponse } from "@/biz/requests/types";
import { TmpRequestResp, UnpackedRequestPayload } from "@/domains/request/utils";
import { Result } from "@/domains/result";
import { Unpacked } from "@/types";

function isGolang(code: string) {
  if (code.match(/:=/)) {
    return true;
  }
  if (code.match(/type [a-zA-Z] struct/)) {
    return true;
  }
  if (code.match(/fmt\./)) {
    return true;
  }
  return false;
}
function isPython(code: string) {
  if (code.match(/'''[\s\S]*?'''|"""[\s\S]*?"""/i)) {
    return true;
  }
  if (code.match(/def\s+\w+\s*\(.*?\)\s*:/i)) {
    return true;
  }
  if (code.match(/elif\s+/i)) {
    return true;
  }
  return false;
}
function isRust(code: string) {
  if (code.match(/fn\s+\w+\s*\(.*?\)\s*:/i)) {
    return true;
  }
  return false;
}
function isTypeScript(code: string) {
  if (code.match(/type [a-zA-Z0-9]{1,} {0,1}= {0,1}\{/)) {
    return true;
  }
  if (code.match(/interface [a-zA-Z0-9]{1,} {0,1}\{/)) {
    return true;
  }
  return false;
}
function isJavaScript(code: string) {
  if (code.match(/=> {0,1}[a-zA-Z0-9{]{1,}/)) {
    return true;
  }
  return false;
}
function isReactJSX(code: string) {
  if (code.match(/from ['"]react['"]/)) {
    return true;
  }
  if (code.match(/className=/) && code.match(/<[a-zA-Z]{1,}/)) {
    return true;
  }
  if (code.match(/style=\{\{/) && code.match(/<[a-zA-Z]{1,}/)) {
    return true;
  }
  if (code.match(/useState|useCallback|useMemo|useEffect/)) {
    return true;
  }
  return false;
}
function isVueFile(code: string) {
  if (code.match(/from ['"]vue['"]/)) {
    return true;
  }
  if (code.match(/<script\s+setup>/)) {
    return true;
  }
  return false;
}
function isHTML(code: string) {
  if (code.match(/<!doctype\s+html>/)) {
    return true;
  }
  if (code.match(/<html[\s>]/i)) {
    return true;
  }
  return false;
}
/**
 * 改进的编程语言和框架检测功能
 * @param {string} code - 要检测的代码
 * @returns {string} - 检测到的语言或框架类型
 */
function detectCodeLanguage(code: string) {
  const lowerCode = code.toLowerCase();
  if (isGolang(lowerCode)) {
    return "Go";
  }
  if (isPython(lowerCode)) {
    return "Python";
  }
  if (isRust(lowerCode)) {
    return "Rust";
  }
  if (isReactJSX(lowerCode)) {
    return "React";
  }
  if (isVueFile(lowerCode)) {
    return "Vue";
  }
  if (isHTML(lowerCode)) {
    return "HTML";
  }
  if (isTypeScript(lowerCode)) {
    return "TypeScript";
  }
  if (isJavaScript(lowerCode)) {
    return "JavaScript";
  }
  return null;
}

function text_content_detector(text: string) {
  if (text.match(/^https{0,1}:\/\//)) {
    return "url";
  }
  if (text.match(/^#[a-f0-9]{3,6}/i)) {
    return "color";
  }
  if (text.match(/^17([0-9]{8}|[0-9]{11})/)) {
    return "timestamp";
  }
  if (text.match(/^{[\s\n]{1,}"[a-zA-Z0-9]{1,}":/)) {
    return "JSON";
  }
  const lang = detectCodeLanguage(text);
  if (lang) {
    return lang;
  }
  //   if (text.match(/<[a-z]{1,}/)) {
  //     return "code";
  //   }
  return null;
}

export function fetchPasteEventList(body: Partial<FetchParams> & Partial<{ types: string[]; keyword: string }>) {
  return request.post<
    ListResponse<{
      id: number;
      content_type: string;
      content: {
        id: number;
        content_type: string;
        text: string;
        image_base64: string;
      };
      created_at: string;
    }>
  >(FetchPasteEventList, body);
}

export function processPartialPasteEvent(
  v: UnpackedRequestPayload<ReturnType<typeof fetchPasteEventList>>["list"][number]
) {
  const t = (() => {
    if (v.content_type === "text" && v.content.text) {
      const t = text_content_detector(v.content.text);
      if (t) {
        return t;
      }
    }
    return v.content_type;
  })();
  return {
    ...v,
    origin_text: v.content.text,
    text: (() => {
      const tt = v.content.text;
      if (t === "timestamp") {
        const dt = dayjs(tt.length === 10 ? Number(tt) * 1000 : Number(tt));
        return dt.format(tt.length === 10 ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD HH:mm:ss");
      }
      return tt;
    })(),
    image_url: v.content.image_base64 ? `data:image/png;base64,${v.content.image_base64}` : null,
    height: (() => {
      // @todo 根据内容类型及所需空间（文本、图片）估算大概值
      return 102;
    })(),
    type: t,
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

export function fetchPasteEventProfile(body: { id: number }) {
  return request.post<{
    id: number;
    content_type: string;
    content: {
      id: number;
      content_type: string;
      text: string;
      image_base64: string;
    };
    created_at: string;
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

export function deletePasteEvent(body: { id: number }) {
  return request.post(DeletePasteEvent, { event_id: body.id });
}

export function openPasteEventPreviewWindow(body: { id: number }) {
  return request.post(PreviewPasteEvent, { event_id: body.id });
}
