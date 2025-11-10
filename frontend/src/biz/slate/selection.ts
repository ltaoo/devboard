/**
 * @file 选区
 * @doc https://developer.mozilla.org/en-US/docs/Web/API/Selection
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { SlatePoint, SlatePointModel } from "./point";
import { SlateDescendant, SlateDescendantType } from "./types";
import { findNodeByPath } from "./op.node";

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
    moveToPrevLineHead() {
      _start = {
        path: [_start.path[0] - 1, 0],
        offset: 0,
      };
      _end = { ..._start };
      methods.refresh();
    },
    calcNextLineHead() {
      const start = {
        path: [_start.path[0] + 1, 0],
        offset: 0,
      };
      const end = { ...start };
      return { start, end };
    },
    moveToNextLineHead() {
      const r = methods.calcNextLineHead();
      _start = r.start;
      _end = r.end;
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
    setToHead() {
      _start = { path: [0], offset: 0 };
      _end = { path: [0], offset: 0 };
      methods.refresh();
    },
    setStartAndEnd(param: { start: SlatePoint; end: SlatePoint }) {
      _start = { ...param.start };
      _end = { ...param.end };
      _is_collapsed = SlatePointModel.isSamePoint(param.start, param.end);
      _dirty = true;
      setTimeout(() => {
        _dirty = false;
      }, 0);
      methods.refresh();
    },
    handleChange(event: { start: SlatePoint; end: SlatePoint; collapsed: boolean }) {
      // console.log("[]slate/selection - handleChange", event.start);
      _start = event.start;
      _end = event.end;
      _is_collapsed = event.collapsed;
      methods.refresh();
    },
  };

  let _start: SlatePoint = { path: [], offset: 0 };
  let _end: SlatePoint = { path: [], offset: 0 };
  let _is_collapsed = true;
  /** 当前选区是否被聚焦 */
  let _is_focused = false;
  /** 当前选区包含的文本格式 */
  let _marks = [];
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
    print() {
      return {
        start: `line: ${_start.path[0]} col: ${_start.offset}`,
        end: `line: ${_end.path[0]} col: ${_end.offset}`,
      };
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

/** 获取指定行的末尾位置 */
SlateSelectionModel.getLineLastPoint = function (nodes: SlateDescendant[], line_idx: number) {
  const path: number[] = [line_idx];
  let offset = 0;
  let node: SlateDescendant | null = nodes[line_idx];
  while (node) {
    if (node.type === SlateDescendantType.Paragraph) {
      path.push(node.children.length - 1);
      node = node.children[node.children.length - 1];
    } else if (node.type === SlateDescendantType.Text) {
      offset = node.text.length;
      node = null;
    }
  }
  return {
    path,
    offset,
  };
};
/** 获取指定行的末尾节点 */
SlateSelectionModel.getLineLastNode = function (nodes: SlateDescendant[], line_idx: number) {
  const path: number[] = [line_idx];
  let offset = 0;
  let node: SlateDescendant | null = nodes[line_idx];
  let result = node;
  while (node) {
    if (node.type === SlateDescendantType.Paragraph) {
      path.push(node.children.length - 1);
      node = node.children[node.children.length - 1];
    } else if (node.type === SlateDescendantType.Text) {
      offset = node.text.length;
      result = node;
      node = null;
    }
  }
  return {
    path,
    offset,
    node: result,
  };
};
/** 获取指定行的首个点 */
SlateSelectionModel.getLineFirstNode = function (nodes: SlateDescendant[], line_idx: number) {
  const path: number[] = [line_idx];
  let offset = 0;
  let node: SlateDescendant | null = nodes[line_idx];
  let result = node;
  while (node) {
    if (node.type === SlateDescendantType.Paragraph) {
      path.push(0);
      node = node.children[0];
    } else if (node.type === SlateDescendantType.Text) {
      result = node;
      node = null;
    }
  }
  return {
    path,
    offset,
    node: result,
  };
};
SlateSelectionModel.isCaretAtLineEnd = function (nodes: SlateDescendant[], start: SlatePoint) {
  const n = findNodeByPath(nodes, start.path);
  if (!n) {
    return false;
  }
  if (n.type === SlateDescendantType.Text) {
    if (start.offset === n.text.length) {
      return true;
    }
  }
  return false;
};
SlateSelectionModel.isCaretAtLineHead = function (nodes: SlateDescendant[], start: SlatePoint) {
  const n = findNodeByPath(nodes, start.path);
  if (!n) {
    return false;
  }
  if (n.type === SlateDescendantType.Text) {
    if (start.offset === 0) {
      return true;
    }
  }
  return false;
};

SlateSelectionModel.removeLine = function (nodes: SlateDescendant[], idx: number) {
  return [...nodes.slice(0, idx), ...nodes.slice(idx + 1)];
};
SlateSelectionModel.removeLinesBetweenStartAndEnd = function (
  nodes: SlateDescendant[],
  start: SlatePoint,
  end: SlatePoint
) {
  return [...nodes.slice(0, start.path[0] + 1), ...nodes.slice(end.path[0] + 1)];
};
SlateSelectionModel.removeNode = function (nodes: SlateDescendant[], point: SlatePoint) {};

export type SlateSelectionModel = ReturnType<typeof SlateSelectionModel>;
