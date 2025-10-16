import { JSX, createSignal } from "solid-js";

import { useViewModelStore } from "@/hooks";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function ModelInList<T>(props: {}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    set(uid: string, v: T) {
      _cache.set(uid, v);
    },
    get(uid: string) {
      return _cache.get(uid) ?? null;
    },
  };
  const ui = {};

  let _cache = new Map<string, T>();
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

export function DynamicContentWithClickModel(props: { onClick?: () => void }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    click() {
      bus.emit(Events.Click);
      _step += 1;
      methods.refresh();
      setTimeout(() => {
        _step -= 1;
        methods.refresh();
      }, 3000);
    },
    handleClick() {
      methods.click();
    },
  };
  const ui = {};

  let _step = 0;
  let _state = {
    get step() {
      return _step;
    },
  };
  enum Events {
    Click,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Click]: void;
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  if (props.onClick) {
    bus.on(Events.Click, props.onClick);
  }

  return {
    methods,
    ui,
    state: _state,
    ready() {},
    destroy() {
      bus.destroy();
    },
    onClick(handler: Handler<TheTypesOfEvents[Events.Click]>) {
      return bus.on(Events.Click, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}
export type DynamicContentWithClickModel = ReturnType<typeof DynamicContentWithClickModel>;

export function DynamicContentWithClick(
  props: {
    store: DynamicContentWithClickModel;
    options: { content: null | JSX.Element }[];
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div
      class={props.class}
      onClick={(event) => {
        vm.methods.handleClick();
      }}
    >
      {(() => {
        const matched = props.options[state().step];
        if (!matched) {
          return null;
        }
        return matched.content;
      })()}
    </div>
  );
}
