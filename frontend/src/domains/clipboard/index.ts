import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { Result } from "@/domains/result";

export function ClipboardModel() {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    readText(): Promise<Result<string>> {
      return Promise.resolve(Result.Err("请实现 readText 方法"));
    },
    writeText(text: string) {},
  };
  const ui = {};
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
    get readText() {
      return methods.readText;
    },
    get writeText() {
      return methods.writeText;
    },
    //     readText() {
    //       return methods.readText();
    //     },
    //     writeText(text: string) {
    //       return methods.writeText(text);
    //     },
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

export type ClipboardModel = ReturnType<typeof ClipboardModel>;
