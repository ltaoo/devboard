import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

type KeyboardEvent = {
  code: string;
  preventDefault: () => void;
};

export function ShortcutModel(props: {}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    register(handlers: Record<string, (event: KeyboardEvent) => void>) {
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
    invokeHandlers(event: KeyboardEvent, key: string) {
      // for (let i = 0; i < _handlers.length; i += 1) {
      // const handler = _handlers[i];
      // handler({ key });
      // }
      const handler2 = _shortcut_map[key];
      // console.log("[]invokeHandlers - ", key, _shortcut_map, handler2);
      if (handler2) {
        handler2(event);
      }
    },
    buildShortcut() {
      const group_codes = Object.keys(_pressed_code_map);
      const key1 = group_codes.join("+");
      const key2 = _pressed_codes.join("");
      return { key1, key2 };
    },
    testShortcut(
      opt: {
        /** 存在 pressing 时，进行拼接后的字符串，用于「组合快捷键」 */
        key1: string;
        /** 没有其他出于 pressing 状态的情况下，按下的按键拼接后的字符串，用于「单个快捷键或连按」 */
        key2: string;
        step: "keydown" | "keyup";
      },
      event: KeyboardEvent
    ) {
      const { key1, key2, step } = opt;
      console.log("[BIZ]shortcut - test shortcut", key1, key2, step, _shortcut_map, _pressed_code_map);

      if (step === "keydown" && key1.includes("+")) {
        // methods.invokeHandlers(event, key1);
        const handler = _shortcut_map[key1];
        if (handler) {
          console.log("[BIZ]shortcut - key1 bingo!", key1, step);
          handler(event);
          return;
        }
      }
      if (step === "keydown" && key2) {
        // methods.invokeHandlers(event, key2);
        const handler = _shortcut_map[key2];
        if (handler) {
          console.log("[BIZ]shortcut - key2 bingo!", key2, step);
          handler(event);
        }
        return;
      }
    },
    handleKeydown(event: { code: string; preventDefault: () => void }) {
      if (_pressed_codes.join("") === event.code && _shortcut_map[[event.code, event.code].join("")]) {
        _pressed_codes.push(event.code);
      } else {
        _pressed_codes = [event.code];
      }
      _pressed_code_map[event.code] = true;
      methods.testShortcut({ ...methods.buildShortcut(), step: "keydown" }, event);
      methods.clearPressedKeys();
    },
    handleKeyup(event: { code: string; preventDefault: () => void }, opt: Partial<{ fake: boolean }> = {}) {
      methods.testShortcut({ ...methods.buildShortcut(), step: "keyup" }, event);
      if (["MetaLeft"].includes(event.code)) {
        _pressed_code_map = {};
      }
      delete _pressed_code_map[event.code];
    },
  };
  const ui = {};

  let _handlers: Handler<TheTypesOfEvents[Events.Shortcut]>[] = [];
  let _shortcut_map: Record<string, (event: { code: string; preventDefault: () => void }) => void> = {};
  let _pressed_codes: string[] = [];
  let _pressed_code_map: Record<string, boolean> = {};
  let _continuous_timer: NodeJS.Timeout | number | null = null;
  let _state = {};
  enum Events {
    Shortcut,
    Keydown,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Shortcut]: { key: string };
    [Events.Keydown]: KeyboardEvent;
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
