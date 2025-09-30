import { RemoteToLocal, LocalToRemote, PingWebDav } from "~/syncservice";

import { request } from "@/biz/requests";

export function pingWebDav(body: { url: string; username: string; password: string }) {
  return request.post<{ ok: boolean }>(PingWebDav, body);
}

export function syncToRemote(body: { url: string; username: string; password: string; root_dir: string }) {
  return request.post<void>(LocalToRemote, body);
}

export function syncFromRemote(body: { url: string; username: string; password: string; root_dir: string }) {
  return request.post<void>(RemoteToLocal, body);
}
