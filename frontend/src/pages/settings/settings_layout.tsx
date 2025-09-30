import { createSignal, For } from "solid-js";

import { PageKeys, ViewComponentProps } from "@/store/types";
import { RouteChildren } from "@/components/route-children";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { useViewModel } from "@/hooks";
import { RouteMenusModel } from "@/domains/route_view";

function SettingsViewModel(props: ViewComponentProps) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $menu: RouteMenusModel({
      route: "root.settings_layout.system" as PageKeys,
      menus: [
        {
          title: "系统",
          url: "root.settings_layout.system",
        },
        {
          title: "同步",
          url: "root.settings_layout.synchronization",
        },
      ] as {
        title: string;
        url: PageKeys;
      }[],
      $history: props.history,
    }),
  };
  let _state = {
    get route() {
      return ui.$menu.state.route_name;
    },
    get menus() {
      return ui.$menu.state.menus;
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

  ui.$menu.onStateChange(() => methods.refresh());

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

export function SettingsView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(SettingsViewModel, [props]);
  // const [routeName, setRouteName] = createSignal<PageKeys>("root.home_layout.index");

  return (
    <div class="flex w-full h-full">
      <div class="p-4 w-[120px] bg-w-bg-5 h-full">
        <div class="space-y-1">
          <For each={state().menus}>
            {(menu) => {
              return (
                <div
                  class=""
                  classList={{
                    "px-4 py-2 rounded-md cursor-pointer hover:bg-w-bg-3": true,
                    "bg-w-bg-2": menu.url === state().route,
                  }}
                  onClick={() => {
                    props.history.push(menu.url);
                  }}
                >
                  {menu.title}
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <div class="flex-1 w-0 p-4">
        <div class="relative">
          <RouteChildren {...props} />
        </div>
      </div>
    </div>
  );
}
