import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

type KeyboardEvent = {
  code: string;
  preventDefault: () => void;
};

export function ShortcutModel(props: Partial<{ mode?: "normal" | "recording" }> = {}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    register(handlers: Record<string, (event: KeyboardEvent & { step?: "keydown" | "keyup" }) => void>) {
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
    setRecordingCodes(codes: string) {
      console.log("[DOMAIN]shortcut - setRecordingCodes", codes);
      codes.split("+").forEach((code) => {
        _pressed_code_map_for_recording[code] = true;
      });
      methods.refresh();
    },
    reset() {
      _pressed_code_map = {};
      _pressed_code_map_for_recording = {};
      methods.refresh();
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
          // console.log("[BIZ]shortcut - key1 bingo!", key1, step);
          // @ts-ignore
          event.step = step;
          handler(event);
          return;
        }
      }
      // 会触发两次啊，不行
      // if (step === "keyup" && key1.includes("+")) {
      //   const handler = _shortcut_map[key1];
      //   if (handler) {
      //     // @ts-ignore
      //     event.step = step;
      //     handler(event);
      //     return;
      //   }
      // }
      if (step === "keydown" && key2) {
        // methods.invokeHandlers(event, key2);
        const handler = _shortcut_map[key2];
        if (handler) {
          // console.log("[BIZ]shortcut - key2 bingo!", key2, step);
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
      _pressed_code_map_for_recording[event.code] = true;
      methods.refresh();
      methods.testShortcut({ ...methods.buildShortcut(), step: "keydown" }, event);
      methods.clearPressedKeys();
    },
    handleKeyup(event: { code: string; preventDefault: () => void }, opt: Partial<{ fake: boolean }> = {}) {
      methods.testShortcut({ ...methods.buildShortcut(), step: "keyup" }, event);
      if (["MetaLeft", "MetaRight"].includes(event.code)) {
        _pressed_code_map = {};
      }
      delete _pressed_code_map[event.code];
      if (Object.keys(_pressed_code_map).length === 0) {
        if (props.mode === "recording") {
          bus.emit(Events.ShortcutComplete, { codes: Object.keys(_pressed_code_map_for_recording) });
        }
      }
      methods.refresh();
    },
  };
  const ui = {};

  let _handlers: Handler<TheTypesOfEvents[Events.Shortcut]>[] = [];
  let _shortcut_map: Record<
    string,
    (event: { code: string; step?: "keydown" | "keyup"; preventDefault: () => void }) => void
  > = {};
  let _pressed_codes: string[] = [];
  let _pressed_code_map_for_recording: Record<string, boolean> = {};
  let _pressed_code_map: Record<string, boolean> = {};
  let _continuous_timer: NodeJS.Timeout | number | null = null;
  let _state = {
    get codes() {
      return Object.keys(_pressed_code_map);
    },
    get codes2() {
      return Object.keys(_pressed_code_map_for_recording);
    },
  };
  enum Events {
    Shortcut,
    Keydown,
    ShortcutComplete,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Shortcut]: { key: string };
    [Events.ShortcutComplete]: { codes: string[] };
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
      return () => {};
    },
    onShortcutComplete(handler: Handler<TheTypesOfEvents[Events.ShortcutComplete]>) {
      return bus.on(Events.ShortcutComplete, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}
