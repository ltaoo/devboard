/**
 * @file 文档区间
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function SlateRangeModel() {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {};

  /** 选区起点、终点公共的父节点 */
  let _common_ancestor_container = null;
  /** 选区起点所在节点*/
  let _start_container = null;
  /** 选区终点所在节点 */
  let _end_container = null;
  let _start_offset = 0;
  /** 选区在 终点节点 中的偏移 */
  let _end_offset = 0;
  /** 选区是否折叠 */
  let _is_collapsed = false;

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
type SlateRangeModel = ReturnType<typeof SlateRangeModel>;
