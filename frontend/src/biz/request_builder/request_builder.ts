import { base, Handler } from "@/domains/base";
import { parse } from "@/biz/curl/parser";

type CookiePayload = {
  name: string;
  value: string;
  /** cookie 作用路径，大部分情况都是 / 表示全站可用 */
  path?: string;
  /** 作用域域名 */
  domain?: string;
  /** 过期时间 UTC格式 */
  expires?: string;
  /** 存活时间，秒数 Max-Age=86400 表示 24小时 */
  max_age?: number;
  /** true 时 js 无法通过 document.cookie 读取 */
  http_only?: boolean;
  /** 仅在 https 请求中传输 */
  secure?: boolean;
  same_site?: "lax" | "strict" | "none";
};
function CookieModel(props: CookiePayload) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };

  let _name = props.name;
  let _value = props.value;
  let _path = props.path ?? "/";
  let _domain = props.domain ?? null;
  let _expires = props.expires ?? "session";
  let _max_age = props.max_age ?? null;
  let _http_only = props.http_only ?? false;
  let _secure = props.secure ?? false;
  let _same_site = props.same_site ?? "none";

  const _state = {
    get name() {
      return _name;
    },
    get value() {
      return _value;
    },
  };

  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  return {
    methods,
    state: _state,
    get name() {
      return _state.name;
    },
    get value() {
      return _state.value;
    },
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}
type CookieModel = ReturnType<typeof CookieModel>;

function CookieManageModel(props: { cookies: CookieModel[] }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    remove(name: string) {
      _cookies = _cookies.filter((v) => v.name !== name);
      methods.refresh();
    },
    append(name: string, value: string, extra: Omit<CookiePayload, "name" | "value"> = {}) {
      _cookies = [
        ..._cookies,
        CookieModel({
          name,
          value,
          ...extra,
        }),
      ];
      methods.refresh();
    },
  };

  let _cookies = props.cookies;
  const _state = {
    get value() {
      return _cookies.map((v) => {
        return v.state;
      });
    },
  };

  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  return {
    methods,
    state: _state,
    setValue(value: typeof props.cookies) {
      _cookies = value;
      methods.refresh();
    },
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}
export type CookieManageModel = ReturnType<typeof CookieManageModel>;

function parse_cookie(cookie: string) {
  let text = cookie.replace(/-b /, "");
  text = text.replace(/^['"]/, "");
  text = text.replace(/['"]$/, "");
  const segments = text.split(/; {0,1}/);
  return segments.map((segment) => {
    const [name, value] = segment.split("=");
    return {
      name,
      value,
    };
  });
}

function HeaderModel(props: { headers: Record<string, string | number> }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    find(key: string) {
      const matched = _headers.find((v) => v.key === key);
      return matched ?? null;
    },
    remove(key: string) {
      _headers = _headers.filter((v) => v.key !== key);
      methods.refresh();
    },
    append(key: string, value: string | number) {
      _headers = [
        ..._headers,
        {
          key,
          value,
        },
      ];
      methods.refresh();
    },
    set(key: string, value: string | number) {
      const matched = methods.find(key);
      if (!matched) {
        return;
      }
      const idx = _headers.findIndex((v) => v === matched);
      if (idx === -1) {
        return;
      }
      _headers = [
        ..._headers.slice(0, idx),
        {
          ...matched,
          value,
        },
        ..._headers.slice(idx + 1),
      ];
    },
    output() {
      return _headers
        .map((h) => {
          return {
            [h.key]: h.value,
          };
        })
        .reduce((a, b) => {
          return { ...a, ...b };
        }, {});
    },
  };

  let _headers = Object.keys(props.headers).map((k) => {
    return {
      key: k,
      value: props.headers[k],
    };
  });
  const _state = {
    get value() {
      return _headers;
    },
  };

  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  return {
    methods,
    state: _state,
    set: methods.set,
    append: methods.append,
    remove: methods.remove,
    output: methods.output,
    setValue(value: typeof props.headers) {
      _headers = Object.keys(value).map((k) => {
        return {
          key: k,
          value: value[k],
        };
      });
      methods.refresh();
    },
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}

type HTTPRequestPayload = {
  url: string;
  method: "POST" | "GET" | "PUT" | "DELETE" | "OPTION";
  headers: Record<string, string | number>;
  cookie: string;
  body: string;
};
export function RequestBuilderModel(props: {} & Partial<HTTPRequestPayload>) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    /** 移除指定header */
    removeHeader(name: string) {
      ui.$header.remove(name);
    },
    /** 增加header */
    appendHeader(name: string, value: string | number) {
      ui.$header.append(name, value);
    },
    /** 修改指定header的值 */
    updateHeader(name: string, value: string | number) {
      ui.$header.set(name, value);
    },
    parseCURLCommand(command: string) {
      const r = parse(command);
      ui.$cookie.setValue(
        r.cookies.map((v) => {
          return CookieModel({ name: v.key, value: v.value });
        })
      );
      ui.$header.setValue(r.headers);
      _url = r.url;
      _method = r.method;
      methods.refresh();
      return r;
    },
  };

  const cookies = props.cookie
    ? parse_cookie(props.cookie).map((c) => {
        return CookieModel({ name: c.name, value: c.value });
      })
    : [];
  const ui = {
    $header: HeaderModel({ headers: props.headers || {} }),
    $cookie: CookieManageModel({ cookies }),
  };

  let _url = props.url ?? "";
  let _method = props.method;

  let _body_json = {};
  const _state = {
    get url() {
      return _url;
    },
    get method() {
      return _method;
    },
    get headers() {
      return ui.$header.state.value;
    },
    get cookies() {
      return ui.$cookie.state.value;
    },
  };

  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$cookie.onStateChange(() => methods.refresh());
  ui.$header.onStateChange(() => methods.refresh());

  return {
    methods,
    state: _state,
    parseCURLCommand: methods.parseCURLCommand,
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}
