import { Match, Show, Switch } from "solid-js";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { fetchPasteEventProfile, fetchPasteEventProfileProcess } from "@/biz/paste/service";
import { toNumber } from "@/utils/primitive";
import { JSONPreviewPanelView } from "@/components/preview-panels/json";

function PreviewModel(props: ViewComponentProps) {
  const request = {
    paste: {
      profile: new RequestCore(fetchPasteEventProfile, {
        process: fetchPasteEventProfileProcess,
        client: props.client,
      }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    async ready() {
      const id = toNumber(props.view.query.id);
      if (id === null) {
        return;
      }
      request.paste.profile.run({ id });
    },
  };
  const ui = {};

  let _state = {
    get profile() {
      return request.paste.profile.response;
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

  request.paste.profile.onStateChange(() => methods.refresh());

  return {
    methods,
    ui,
    state: _state,
    ready() {
      methods.ready();
    },
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

export function PreviewView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(PreviewModel, [props]);

  return (
    <div>
      <Show when={state().profile}>
        <Switch fallback={<div>{state().profile?.content.text!}</div>}>
          <Match when={state().profile?.type === "json"}>
            <JSONPreviewPanelView text={state().profile?.content.text!} />
          </Match>
        </Switch>
      </Show>
    </div>
  );
}
