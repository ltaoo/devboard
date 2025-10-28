import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { HttpClientCore } from "@/domains/http_client";
import { toNumber } from "@/utils/primitive";
import { createRemark, deleteRemark, fetchRemarkList, fetchRemarkListProcess } from "@/biz/remark/service";
import { ListCore } from "@/domains/list";

import { fetchPasteEventProfile, fetchPasteEventProfileProcess } from "./service";
import { TheItemTypeFromListCore } from "@/domains/list/typing";

export function PasteEventProfileModel(props: { client: HttpClientCore }) {
  const request = {
    paste: {
      profile: new RequestCore(fetchPasteEventProfile, {
        process: fetchPasteEventProfileProcess,
        client: props.client,
      }),
    },
    remark: {
      list: new ListCore(new RequestCore(fetchRemarkList, { process: fetchRemarkListProcess, client: props.client })),
      create: new RequestCore(createRemark, { client: props.client }),
      delete: new RequestCore(deleteRemark, { client: props.client }),
    },
  };

  type RemarkOfPasteEvent = TheItemTypeFromListCore<typeof request.remark.list>;

  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    load(id?: string) {
      _id = id ?? null;
      if (_id === null) {
        _error = new BizError(["id 参数不正确"]);
        bus.emit(Events.Error, _error);
        return;
      }
      request.paste.profile.run({ id: _id });
      request.remark.list.search({ paste_event_id: _id });
    },
    async deleteRemark(v: RemarkOfPasteEvent) {
      const r = await request.remark.delete.run({ id: v.id });
      if (r.error) {
        return;
      }
      request.remark.list.deleteItem((vv) => {
        return vv.id === v.id;
      });
    },
    async reloadRemarks() {
      if (!_id) {
        _error = new BizError(["id 参数不正确"]);
        bus.emit(Events.Error, _error);
        return;
      }
      request.remark.list.search({ paste_event_id: _id });
    },
  };
  const ui = {};

  let _id: null | string = null;
  let _error: null | BizError = null;
  let _state = {
    get profile() {
      if (request.paste.profile.response === null) {
        return null;
      }
      return {
        ...request.paste.profile.response,
        remark: request.remark.list.response,
      };
    },
    get error() {
      return _error ?? request.paste.profile.error;
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
  request.remark.list.onStateChange(() => methods.refresh());

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
