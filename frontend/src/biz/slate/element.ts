/**
 * @file 元素
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function SlateElementModel(props: {
  key: string;
  data: Record<string, unknown>;
  /** 节点类型 */
  object: unknown;
}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    addMark() {},
    getParent() {},
    getPreviousNode(path: unknown) {},
    getNextNode() {},
    findDescendant(predicate: unknown) {},
    insertNode(path: unknown, node: unknown) {},
    removeNode(path: unknown) {},
  };
  const ui = {};

  /** 节点在文档中的索引 */
  let _key = props.key;
  /** 节点数据 */
  let _data = props.data;
  /** 节点类型 */
  let _object = props.object;
  /** 子孙节点 */
  let _nodes = [];

  let _state = {
    get text() {
      return "";
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

SlateElementModel.create = function () {};
SlateElementModel.fromJSON = function (value = {}) {};
SlateElementModel.toJSON = function (options = {}) {};

type SlateElementModel = ReturnType<typeof SlateElementModel>;
