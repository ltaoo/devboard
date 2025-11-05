/**
 * @file 路径
 * 可以根据给定的 number[] 从树上找到指定节点
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export type SlatePoint = {
  path: number[];
  offset: number;
};

export function SlatePointModel(props: {}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {};

  let _key = 0;
  let _path = [];
  let _offset = 0;

  let _state = {};
  enum Events {
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

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

SlatePointModel.isSamePoint = function (a: SlatePoint, b: SlatePoint) {
  return a.path.join("_") === b.path.join("_") && a.offset === b.offset;
};

export type SlatePointModel = ReturnType<typeof SlatePointModel>;
