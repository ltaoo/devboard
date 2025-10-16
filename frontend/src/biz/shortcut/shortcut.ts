import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

export function ShortcutModel(props: {}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    register(handlers: Record<string, Function>) {
      const keys = Object.keys(handlers);
      for (let i = 0; i < keys.length; i += 1) {
        const handle_key = keys[i];
        const multiple = handle_key.split(",");
        for (let j = 0; j < multiple.length; j += 1) {
          _shortcut_map[multiple[j]] = handlers[handle_key];
        }
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
    invokeHandlers(key: string) {
      // for (let i = 0; i < _handlers.length; i += 1) {
      // const handler = _handlers[i];
      // handler({ key });
      // }
      const handler2 = _shortcut_map[key];
      // console.log("[]invokeHandlers - ", key, _shortcut_map, handler2);
      if (handler2) {
        handler2();
      }
    },
    buildShortcut() {
      const group_codes = Object.keys(_pressed_code_map);
      const key1 = group_codes.join("+");
      const key2 = _pressed_codes.join("");
      return { key1, key2 };
    },
    testShortcut(opt: { key1: string; key2: string; step: "keydown" | "keyup" }) {
      const { key1, key2, step } = opt;
      // const group_handler1 = _shortcut_map[key1];
      // const single_handler2 = _shortcut_map[key2];
      // console.log("[BIZ]shortcut - test shortcut", key1, key2, step);
      if (step === "keyup" && key1.includes("+")) {
        // console.log("[]invoke key1");
        methods.invokeHandlers(key1);
        return;
      }
      // if (key2) {
      // methods.invokeHandlers(key1);
      // return;
      // const handler = _shortcut_map[key];
      // //   console.log("[BIZ]shortcut - handleKeyup", key, _shortcut_map, handler);
      // if (handler) {
      //   if (opt.step === "keydown") {
      //     _duplicate_check_map[key] = true;
      //   }
      //   if (opt.step === "keyup") {
      //     _duplicate_check_map[key] = true;
      //     return;
      //   }
      //   handler();
      //   return;
      // }
      // }
      if (step === "keydown" && key2) {
        // console.log("[]invoke key2");
        methods.invokeHandlers(key2);
        return;

        // const handler2 = _shortcut_map[key2];
        // //   console.log("[BIZ]shortcut - handleKeyup", key2, _shortcut_map, handler2);
        // if (handler2) {
        //   if (opt.step === "keydown") {
        //     _duplicate_check_map[key] = true;
        //   }
        //   if (opt.step === "keyup") {
        //     _duplicate_check_map[key] = true;
        //     return;
        //   }
        //   handler2();
        //   return;
        // }
      }
    },
    handleKeydown(event: { code: string }) {
      // if (_is_long_press) {
      //   methods.handleKeyup(event, { fake: true });
      //   return;
      // }
      // console.log("[]handleKeydown", _pressed_codes.join(""));
      if (_pressed_codes.join("") === event.code && _shortcut_map[[event.code, event.code].join("")]) {
        _pressed_codes.push(event.code);
      } else {
        _pressed_codes = [event.code];
      }
      _pressed_code_map[event.code] = true;
      methods.testShortcut({ ...methods.buildShortcut(), step: "keydown" });
      methods.clearPressedKeys();
      // _pressed_codes.push(event.code);
      // methods.testShortcut({ step: "keydown" });
      // methods.clearPressedKeys();
      // if (_long_press_timer === null) {
      //   _long_press_timer = setTimeout(() => {
      //     if (_pressed_code_map[event.code]) {
      //       _is_long_press = true;
      //       methods.handleKeyup(event, { fake: true });
      //     }
      //   }, 800);
      // }
    },
    handleKeyup(event: { code: string }, opt: Partial<{ fake: boolean }> = {}) {
      // if (opt.fake) {
      //   methods.testShortcut({ step: "keyup" });
      //   return;
      // }
      // _is_long_press = false;
      // if (_long_press_timer !== null) {
      //   clearTimeout(_long_press_timer);
      //   _long_press_timer = null;
      // }
      methods.testShortcut({ ...methods.buildShortcut(), step: "keyup" });
      // //       console.log("[BIZ]shortcut - before delete code", event.code);
      delete _pressed_code_map[event.code];
    },
  };
  const ui = {};

  let _handlers: Handler<TheTypesOfEvents[Events.Shortcut]>[] = [];
  let _shortcut_map: Record<string, Function> = {};
  let _pressed_codes: string[] = [];
  let _pressed_code_map: Record<string, boolean> = {};
  let _continuous_timer: NodeJS.Timeout | number | null = null;
  let _is_long_press = false;
  let _long_press_timer: NodeJS.Timeout | number | null = null;
  let _duplicate_check_map: Record<string, boolean> = {};
  let _state = {};
  enum Events {
    Shortcut,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Shortcut]: { key: string };
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
    onShortcut(handler: Handler<TheTypesOfEvents[Events.Shortcut]>) {
      _handlers.push(handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}
