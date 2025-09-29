import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function BackToTopModel(props: { clientHeight?: number }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    handleScroll(v: { top: number }) {
      _scroll_top = v.top;
      let next_show_back_top = false;
      if (_scroll_top >= _client_height) {
        if (next_show_back_top === false) {
          next_show_back_top = true;
        }
      }
      if (_show_back_top === next_show_back_top) {
        return;
      }
      _show_back_top = next_show_back_top;
      methods.refresh();
    },
  };
  const ui = {};

  let _client_height = props.clientHeight ?? 680;
  let _scroll_top = 0;
  let _show_back_top = false;
  let _state = {
    get showBackTop() {
      return _show_back_top;
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
