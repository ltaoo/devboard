import { CreateRemark } from "~/remarkservice";

import { request } from "@/biz/requests";

export function createRemark(body: { content: string; paste_event_id: string }) {
  return request.post<{ id: string }>(CreateRemark, body);
}
