/**
 * @file 路径
 * 可以根据给定的 number[] 从树上找到指定节点
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function SlatePathModel(props: {}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {};

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

SlatePathModel.isPath = function isPath(value: any) {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === "number");
};
SlatePathModel.equals = function isPath(path: number[], another: number[]) {
  return path.length === another.length && path.every((n, i) => n === another[i]);
};
SlatePathModel.previous = function (path: number[]) {
  const last = path[path.length - 1];
  return path.slice(0, -1).concat(last - 1);
};
/**
 * 是层级最深的节点（叶节点），且相同父节点，且 path 位置在 another 前面
 * 如
 * [0, 1, 2] [0, 1, 3]
 * [0, 1, 0] [0, 1, 5]
 */
SlatePathModel.endsBefore = function (path: number[], another: number[]): boolean {
  const i = path.length - 1;
  const as = path.slice(0, i);
  const bs = another.slice(0, i);
  const av = path[i];
  const bv = another[i];
  return SlatePathModel.equals(as, bs) && av < bv;
};
/** 比较两个路径，如果一个是另一个的父节点，则返回0 */
SlatePathModel.compare = function (path: number[], another: number[]): -1 | 0 | 1 {
  const min = Math.min(path.length, another.length);
  for (let i = 0; i < min; i++) {
    if (path[i] < another[i]) return -1;
    if (path[i] > another[i]) return 1;
  }
  return 0;
};
/** path是否是another的祖先 */
SlatePathModel.isAncestor = function (path: number[], another: number[]): boolean {
  return path.length < another.length && SlatePathModel.compare(path, another) === 0;
};
SlatePathModel.parent = function (path: number[]) {
  return path.slice(0, -1);
};

type SlatePathModel = ReturnType<typeof SlatePathModel>;
