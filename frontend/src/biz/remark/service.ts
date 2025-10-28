import dayjs from "dayjs";

import { CreateRemark, FetchRemarkList, DeleteRemark } from "~/remarkservice";

import { request } from "@/biz/requests";
import { ListResponse } from "@/biz/requests/types";
import { FetchParams } from "@/domains/list/typing";
import { TmpRequestResp } from "@/domains/request/utils";
import { Result } from "@/domains/result";

export function createRemark(body: { content: string; paste_event_id: string }) {
  return request.post<{ id: string }>(CreateRemark, body);
}

export function deleteRemark(body: { id: string }) {
  return request.post<{ id: string }>(DeleteRemark, body);
}

export function fetchRemarkList(body: Partial<FetchParams> & { paste_event_id: string }) {
  return request.post<
    ListResponse<{
      id: string;
      content: string;
      created_at: string;
    }>
  >(FetchRemarkList, body);
}
export function fetchRemarkListProcess(r: TmpRequestResp<typeof fetchRemarkList>) {
  if (r.error) {
    return Result.Err(r.error);
  }
  return Result.Ok({
    ...r.data,
    list: r.data.list.map((v) => {
      return {
        ...v,
        created_at_text: dayjs(Number(v.created_at)).format("YYYY-MM-DD HH:mm"),
      };
    }),
  });
}
