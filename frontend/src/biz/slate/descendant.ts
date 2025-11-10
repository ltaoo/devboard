/**
 * @file 节点
 * 提供最基础的能力
 * Document、Block、Inline、Text 都会内部包含该节点模型，来实现调用该础能力
 */

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { SlateDescendant, SlateDescendantType } from "./types";

export function SlateDescendantModel(props: {} & SlateDescendant) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setText(text: string) {
      _text = text;
      methods.refresh();
    },
    getText() {},
    getNode() {},
    getPath() {},
    normalize() {},
    validate() {},
  };
  const ui = {};

  let _text = props.type === SlateDescendantType.Text ? props.text : "";
  let _children = props.type === SlateDescendantType.Paragraph ? props.children : [];
  let _state: {} & SlateDescendant = {
    get type() {
      return props.type;
    },
    get text() {
      return _text;
    },
    get children() {
      return _children;
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
    ui,
    state: _state,
    type: props.type,
    setText: methods.setText,
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

type SlateDescendantModel = ReturnType<typeof SlateDescendantModel>;
