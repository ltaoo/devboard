/**
 * @file 选区
 * @doc https://developer.mozilla.org/en-US/docs/Web/API/Selection
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { SlatePoint, SlatePointModel } from "./point";
import { SlateDescendant } from "./types";

export function SlateSelectionModel() {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    /** 光标向前移动n步 */
    moveForward(param: Partial<{ step: number; min: number; collapse: boolean }> = {}) {
      const { step = 1, collapse = true } = param;
      _start.offset += step;
      _end.offset = _start.offset;
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    /** 光标向后移动n步 */
    moveBackward(param: Partial<{ step: number; min: number }> = {}) {
      const { step = 1, min = 0 } = param;
      _start.offset -= step;
      if (_start.offset < min) {
        _start.offset = min;
      }
      _end.offset = _start.offset;
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    moveToNextLineHead() {
      _start = {
        path: [_start.path[0] + 1, 0],
        offset: 0,
      };
      _end = { ..._start };
      //       console.log("[]moveToNextLineHead - ", _start);
      methods.refresh();
    },
    /** 从选区变成位于起点的光标 */
    collapseToHead() {
      _end = { ..._start };
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    /** 从选区变成位于终点光标 */
    collapseToEnd() {
      _start = { ..._end };
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    collapseToOffset(param: { offset: number }) {
      _start.offset = param.offset;
      _end = { ..._start };
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    setStartAndEnd(param: { start: SlatePoint; end: SlatePoint }) {
      _start = param.start;
      _end = param.end;
      _is_collapsed = SlatePointModel.isSamePoint(param.start, param.end);
      _dirty = true;
      setTimeout(() => {
        _dirty = false;
      }, 0);
      methods.refresh();
    },
    handleChange(event: { start: SlatePoint; end: SlatePoint; collapsed: boolean }) {
      //       console.log("[]slate/selection - handleChange", event.start);
      _start = event.start;
      _end = event.end;
      _is_collapsed = event.collapsed;
      methods.refresh();
    },
  };

  let _start: SlatePoint = { path: [], offset: 0 };
  let _end: SlatePoint = { path: [], offset: 0 };
  let _is_collapsed = true;
  let _dirty = false;
  const ui = {};

  let _state = {
    get start() {
      return {
        ..._start,
        line: _start.path[0],
      };
    },
    get end() {
      return {
        ..._end,
        line: _end.path[0],
      };
    },
    get collapsed() {
      return _is_collapsed;
    },
    get dirty() {
      return _dirty;
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

  return {
    methods,
    ui,
    state: _state,
    get dirty() {
      return _state.dirty;
    },
    get start() {
      return _state.start;
    },
    get end() {
      return _state.end;
    },
    get collapsed() {
      return _state.collapsed;
    },
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

export type SlateSelectionModel = ReturnType<typeof SlateSelectionModel>;

// export function SlateSelectionModel() {
//   const methods = {
//     refresh() {
//       bus.emit(Events.StateChange, { ..._state });
//     },
//   };
//   const ui = {};

//   /** 选区的起始节点 */
//   let _anchor_node = null;
//   /** 选区的终点节点 */
//   let _focus_node = null;
//   /** 选区在 起始节点 中的偏移 */
//   let _anchor_offset = 0;
//   /** 选区在 终点节点 中的偏移 */
//   let _focus_offset = 0;
//   /** 选区是否折叠 */
//   let _is_collapsed = false;
//   /** 当前选区是否被聚焦 */
//   let _is_focused = false;
//   /** 当前选区包含的文本格式 */
//   let _marks = [];

//   let _state = {};
//   enum Events {
//     StateChange,
//     Error,
//   }
//   type TheTypesOfEvents = {
//     [Events.StateChange]: typeof _state;
//     [Events.Error]: BizError;
//   };
//   const bus = base<TheTypesOfEvents>();

//   return {
//     methods,
//     ui,
//     state: _state,
//     ready() {},
//     destroy() {
//       bus.destroy();
//     },
//     onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
//       return bus.on(Events.StateChange, handler);
//     },
//     onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
//       return bus.on(Events.Error, handler);
//     },
//   };
// }
