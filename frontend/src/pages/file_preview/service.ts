import { FileService } from "~/index";

import { request_factory } from "@/domains/request/utils";
import { Result } from "@/domains/result";

export const request = request_factory({
  hostnames: {},
  process<T>(r: Result<string>) {
    if (r.error) {
      return Result.Err(r.error);
    }
    return Result.Ok(r.data);
  },
});

export function fetch_file_url(f: string) {
  const body = f as any;
  return request.post<string>(FileService.URL, body);
}
