/**
 *
 */
import { OpenWindow } from "~/commonservice";
import { OpenWindowBody } from "~/models";

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
