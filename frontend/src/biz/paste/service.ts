import dayjs from "dayjs";

import { FetchPasteEventList, FetchPasteEventProfile, Preview } from "~/pasteservice";
import { PasteEventProfileBody, PastePreviewBody } from "~/models";

import { FetchParams } from "@/domains/list/typing";
import { request } from "@/biz/requests";
import { ListResponse } from "@/biz/requests/types";
import { TmpRequestResp } from "@/domains/request/utils";
import { Result } from "@/domains/result";

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
  if (text.match(/^{[\s\n]{1,}"[a-zA-Z0-9]{1,}":/)) {
    return "json";
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

export function fetchPasteEventProfile(body: { id: number }) {
  return request.post<{
    id: number;
    content_type: string;
    content: {
      text: string;
    };
    created_at: string;
  }>(FetchPasteEventProfile, new PasteEventProfileBody({ event_id: body.id }));
}
export function fetchPasteEventProfileProcess(r: TmpRequestResp<typeof fetchPasteEventProfile>) {
  if (r.error) {
    return Result.Err(r.error);
  }
  const v = r.data;
  return Result.Ok({
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
  });
}

export function openPreviewWindow(body: { id: number }) {
  return request.post(Preview, new PasteEventProfileBody({ event_id: body.id }));
}
