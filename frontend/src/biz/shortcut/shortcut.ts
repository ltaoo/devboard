import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function ShortcutModel(props: {}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    register(shortcut: string, handler: Function) {
      const multiple = shortcut.split(",");
      for (let i = 0; i < multiple.length; i += 1) {
        const s = multiple[i];
        _shortcut_map[s] = handler;
      }
    },
    clearPressedKeys() {
      if (_continuous_timer !== null) {
        clearTimeout(_continuous_timer);
        _continuous_timer = null;
      }
      _continuous_timer = setTimeout(() => {
        _pressed_codes = [];
      }, 200);
    },
    testShortcut() {
      const codes = Object.keys(_pressed_code_map);
      const key = codes.join("+");
      if (key) {
        const handler = _shortcut_map[key];
        //   console.log("[BIZ]shortcut - handleKeyup", key, _shortcut_map, handler);
        if (handler) {
          handler();
          return;
        }
      }
      const key2 = _pressed_codes.join("");
      if (key2) {
        const handler2 = _shortcut_map[key2];
        //   console.log("[BIZ]shortcut - handleKeyup", key2, _shortcut_map, handler2);
        if (handler2) {
          handler2();
          return;
        }
      }
    },
    // 考虑长按的场景
    handleKeydown(event: { code: string }) {
      if (_is_long_press) {
        methods.handleKeyup(event, { fake: true });
        return;
      }
      _pressed_codes.push(event.code);
      _pressed_code_map[event.code] = true;
      methods.clearPressedKeys();
      if (_long_press_timer === null) {
        _long_press_timer = setTimeout(() => {
          if (_pressed_code_map[event.code]) {
            // long press
            _is_long_press = true;
            methods.handleKeyup(event, { fake: true });
          }
        }, 100);
      }
    },
    handleKeyup(event: { code: string }, opt: Partial<{ fake: boolean }> = {}) {
      if (opt.fake) {
        methods.testShortcut();
        return;
      }
      _is_long_press = false;
      if (_long_press_timer !== null) {
        clearTimeout(_long_press_timer);
        _long_press_timer = null;
      }
      methods.testShortcut();
//       console.log("[BIZ]shortcut - before delete code", event.code);
      delete _pressed_code_map[event.code];
    },
  };
  const ui = {};

  let _shortcut_map: Record<string, Function> = {};
  let _pressed_codes: string[] = [];
  let _pressed_code_map: Record<string, boolean> = {};
  let _continuous_timer: NodeJS.Timeout | number | null = null;
  let _is_long_press = false;
  let _long_press_timer: NodeJS.Timeout | number | null = null;
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
