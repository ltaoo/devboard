import { FetchComputeInfo } from "~/systemservice";

import { request } from "@/biz/requests";

export function fetchSystemInfo() {
  return request.post<{ hostname: string; os: string; arch: string }>(FetchComputeInfo);
}
