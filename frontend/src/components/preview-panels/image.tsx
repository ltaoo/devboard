import { createSignal } from "solid-js";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { useViewModel } from "@/hooks";
import { ScrollViewCore } from "@/domains/ui";

function ImageContentPreviewModel(props: { url: string }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
  };

  let _url = props.url;
  let _state = {
    get url() {
      return _url;
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

export function ImageContentPreview(props: { url: string }) {
  const [state, vm] = useViewModel(ImageContentPreviewModel, [props]);
  // const [text, setText] = createSignal(JSON.stringify(JSON.parse(props.text), null, 4));

  return (
    <div class="absolute inset-0">
      <div class="">
        <img class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[80vh] object-contain" src={state().url} />
      </div>
    </div>
  );
}
