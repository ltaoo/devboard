/**
 *
 */
import { Events } from "@wailsio/runtime";

import { OpenWindow, ShowError } from "~/commonservice";
import { FetchApplicationState } from "~/systemservice";

import { PageKeys, mapPathnameWithPageKey } from "@/store/routes";

import { request } from "@/biz/requests";

export function fetchApplicationState() {
  // return new Promise((resolve) => {
  //   Events.On("lifecycle:ready", (event) => {
  //     resolve(null);
  //   });
  // });
  return request.post<{ ready: boolean }>(FetchApplicationState, {});
}

export function openWindow(body: { title: string; route: PageKeys }) {
  const url = mapPathnameWithPageKey(body.route);
  return request.post<void>(OpenWindow, {
    title: body.title,
    url,
  });
}

export function showError(body: { title: string; content: string }) {
  return request.post<void>(ShowError, {
    title: body.title,
    content: body.content,
  });
}
