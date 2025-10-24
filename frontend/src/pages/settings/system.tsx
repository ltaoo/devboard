import { For, Show } from "solid-js";
import { Check } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { fetchSystemInfo } from "@/biz/system/service";
import { ScrollView } from "@/components/ui";
import { ScrollViewCore } from "@/domains/ui";

function SystemInfoModel(props: ViewComponentProps) {
  const request = {
    system: {
      info: new RequestCore(fetchSystemInfo, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    ready() {
      request.system.info.run();
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
  };
  let _state = {
    get profile() {
      return request.system.info.response;
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

  request.system.info.onStateChange(() => methods.refresh());

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

export function SystemInfoView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(SystemInfoModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <Show when={state().profile}>
        <div class="space-y-4">
          <div>
            <div class="text-2xl">本机信息</div>
            <For each={state().profile?.device}>
              {(field) => {
                return (
                  <div class="field text-w-fg-0">
                    <div>{field.label}</div>
                    <div>{field.text}</div>
                  </div>
                );
              }}
            </For>
          </div>
          <div>
            <div class="text-2xl">应用信息</div>
            <For each={state().profile?.app}>
              {(field) => {
                return (
                  <div class="field text-w-fg-0">
                    <div>{field.label}</div>
                    <div>{field.text}</div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </ScrollView>
  );
}
