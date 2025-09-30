import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { HttpClientCore } from "@/domains/http_client";
import { toNumber } from "@/utils/primitive";

import { fetchPasteEventProfile, fetchPasteEventProfileProcess } from "./service";

export function PasteEventProfileModel(props: { client: HttpClientCore }) {
  const request = {
    paste: {
      profile: new RequestCore(fetchPasteEventProfile, {
        process: fetchPasteEventProfileProcess,
        client: props.client,
      }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    load(id?: string) {
      if (!id) {
        request.paste.profile.setError(new BizError(["id 参数不正确"]));
        return;
      }
      request.paste.profile.run({ id });
    },
  };
  const ui = {};
  let _state = {
    get profile() {
      return request.paste.profile.response;
    },
    get error() {
      return request.paste.profile.error;
    },
  };
  enum Events {
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  request.paste.profile.onStateChange(() => methods.refresh());

  return {
    methods,
    ui,
    state: _state,
    ready() {},
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}

export type PasteEventProfileModel = ReturnType<typeof PasteEventProfileModel>;
