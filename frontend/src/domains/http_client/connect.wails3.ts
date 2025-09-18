import { Result } from "@/domains/result/index";

import { HttpClientCore } from "./index";

export function connect(store: HttpClientCore) {
  store.fetch = async (options) => {
    const { url, method, id, data, headers } = options;
    if (typeof url !== "function") {
      return Result.Err("fn 不是函数");
    }
    try {
      console.log("[]HttpClient - before await url", data);
      // @ts-ignore
      const r: any = await url(data as any);
      console.log("[]connect.wails3 - after await url", r);
      if (!r) {
        throw new Error("Missing the response");
      }
      return Promise.resolve({ data: r ?? {} });
    } catch (err) {
      throw err;
    }
  };
  store.cancel = (id: string) => {
    return Result.Ok(null);
  };
}
