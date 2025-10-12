import dayjs, { Dayjs } from "dayjs";
import { createSignal, JSX } from "solid-js";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { useViewModel } from "@/hooks";

// const bus
// setInterval(() => {

// }, 60 * 1000);
function RelativeTimeModel(props: { time: Dayjs }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {};

  let _text = props.time.fromNow();
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

  let timer: null | NodeJS.Timer = setInterval(() => {
    _text = props.time.fromNow();
    methods.refresh();
  }, 60 * 1000);

  return {
    methods,
    ui,
    state: _state,
    ready() {},
    destroy() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
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

enum Events {
  StateChange,
  Update,
  Error,
}
type TheTypesOfEvents = {
  [Events.Update]: string;
  [Events.Error]: BizError;
};
const bus = base<TheTypesOfEvents>();
setInterval(() => {
  bus.emit(Events.Update);
}, 30 * 1000);

export function RelativeTime(props: { time: Dayjs } & JSX.HTMLAttributes<HTMLDivElement>) {
  const [text, setText] = createSignal(props.time.fromNow());

  bus.on(Events.Update, () => {
    setText(props.time.fromNow());
  });

  return (
    <div class={props.class} classList={props.classList}>
      {text()}
    </div>
  );
}
