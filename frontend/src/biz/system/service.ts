import { FetchComputeInfo } from "~/systemservice";

import { request } from "@/biz/requests";

export function fetchSystemInfo() {
  return request.post<{
    fields: {
      key: string;
      label: string;
      text: string;
    }[];
  }>(FetchComputeInfo);
}
