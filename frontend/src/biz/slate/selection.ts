/**
 * @file 选区
 * @doc https://developer.mozilla.org/en-US/docs/Web/API/Selection
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function SlateSelectionModel() {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {};

  /** 选区的起始节点 */
  let _anchor_node = null;
  /** 选区的终点节点 */
  let _focus_node = null;
  /** 选区在 起始节点 中的偏移 */
  let _anchor_offset = 0;
  /** 选区在 终点节点 中的偏移 */
  let _focus_offset = 0;
  /** 选区是否折叠 */
  let _is_collapsed = false;
  /** 当前选区是否被聚焦 */
  let _is_focused = false;
  /** 当前选区包含的文本格式 */
  let _marks = [];

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

type SlateSelectionModel = ReturnType<typeof SlateSelectionModel>;
