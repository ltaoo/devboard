import { FetchComputeInfo } from "~/systemservice";

import { request } from "@/biz/requests";

export function fetchSystemInfo() {
  return request.post<{
    device: {
      key: string;
      label: string;
      text: string;
    }[];
    app: {
      key: string;
      label: string;
      text: string;
    }[];
  }>(FetchComputeInfo);
}
