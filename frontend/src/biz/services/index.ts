/**
 *
 */
import { OpenWindow, ShowError } from "~/commonservice";
import { ErrorBody, OpenWindowBody } from "~/models";

import { PageKeys, mapPathnameWithPageKey } from "@/store/routes";

import { request } from "@/biz/requests";

export function openWindow(body: { title: string; route: PageKeys }) {
  const url = mapPathnameWithPageKey(body.route);
  return request.post<void>(
    OpenWindow,
    new OpenWindowBody({
      title: body.title,
      url,
    })
  );
}

export function showError(body: { title: string; content: string }) {
  return request.post<void>(
    ShowError,
    new ErrorBody({
      title: body.title,
      content: body.content,
    })
  );
}
