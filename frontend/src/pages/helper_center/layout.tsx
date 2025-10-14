import { createSignal, For } from "solid-js";

import { PageKeys, ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { RouteChildren } from "@/components/route-children";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RouteMenusModel } from "@/domains/route_view";

function HelperCenterLayoutViewModel(props: ViewComponentProps) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $menu: RouteMenusModel({
      route: "root.helper_center.shortcut" as PageKeys,
      menus: [
        {
          title: "快捷键",
          url: "root.helper_center.shortcut",
        },
        // {
        //   title: "数据同步",
        //   url: "root.settings_layout.category",
        // },
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

export function HelperCenterLayoutView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(HelperCenterLayoutViewModel, [props]);
  // const [routeName, setRouteName] = createSignal<PageKeys>("root.home_layout.index");

  return (
    <div class="flex w-full h-full">
      <div class="p-2 w-[120px] h-full border-r border-w-fg-3 bg-w-bg-1">
        <div class="space-y-1">
          <For each={state().menus}>
            {(menu) => {
              return (
                <div
                  class=""
                  classList={{
                    "px-4 py-2 rounded-md cursor-pointer hover:bg-w-fg-4": true,
                    "bg-w-fg-4": menu.url === state().route,
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
      <div class="relative flex-1 w-0">
        <RouteChildren {...props} />
      </div>
    </div>
  );
}
