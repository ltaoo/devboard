/**
 * @file 文本节点
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

function SlateLeafModel(props: { text: string }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {};

  let _text = props.text;
  /** 文本节点的所有标记 */
  let _mark = SlateMarkModel();

  let _state = {
    get text() {
      return _text;
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
export type SlateLeafModel = ReturnType<typeof SlateLeafModel>;

function SlateMarkModel() {}
export type SlateMarkModel = ReturnType<typeof SlateMarkModel>;

export function SlateTextNodeModel(props: {
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
  /** 节点类型 */
  let _object = props.object;
  /** 文本叶子节点，不同格式（例如加粗、斜体等）的文本会被拆分为若干个 leaf */
  let _leaves = [];
  /** 文本节点的所有标记 */
  let _marks = [];

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

SlateTextNodeModel.create = function () {};
SlateTextNodeModel.fromJSON = function (value = {}) {};
SlateTextNodeModel.toJSON = function (options = {}) {};

type SlateTextNodeModel = ReturnType<typeof SlateTextNodeModel>;
