/**
 * @file 后台/首页布局
 */
import { For, JSX, createSignal } from "solid-js";
import {
  Users,
  Home,
  Bike,
  BicepsFlexed,
  User,
  Star,
  Boxes,
  Settings,
  List,
  ClipboardList,
  HelpCircle,
  Bot,
} from "lucide-solid";

import { pages } from "@/store/views";
import { ViewComponent, ViewComponentProps } from "@/store/types";
import { mapPathnameWithPageKey, PageKeys, routes, routesWithPathname } from "@/store/routes";
import { useViewModel } from "@/hooks";
import { Show } from "@/packages/ui/show";
import { RouteChildren } from "@/components/route-children";
import { KeepAliveRouteView } from "@/components/ui";

import { base, Handler } from "@/domains/base";
import { RequestCore } from "@/domains/request";
import { RouteMenusModel } from "@/domains/route_view";
import { openWindow } from "@/biz/services";

function HomeLayoutViewModel(props: ViewComponentProps) {
  const request = {
    common: {
      open_window: new RequestCore(openWindow, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    gotoWorkoutPrepareView() {
      // props.history.push("root.workout_day_prepare");
    },
  };
  const ui = {
    $menu: RouteMenusModel({
      route: "root.home_layout.index" as PageKeys,
      menus: [
        {
          title: "首页",
          icon: <ClipboardList class="w-6 h-6" />,
          url: "root.home_layout.index",
        },
        // {
        //   title: "工具",
        //   icon: <Boxes class="w-6 h-6" />,
        // },
        {
          title: "设置",
          icon: <Settings class="w-6 h-6" />,
          // url: "root.home_layout.mine",
          // url: "root.settings_layout.system",
          onClick() {
            request.common.open_window.run({
              title: "设置",
              route: "root.settings.system",
            });
          },
        },
      ] as { title: string; icon: JSX.Element; badge?: boolean; url?: PageKeys; onClick?: () => void }[],
      $history: props.history,
    }),
    $menu2: RouteMenusModel({
      route: "root.home_layout.index" as PageKeys,
      menus: [
        // {
        //   title: "控制台",
        //   icon: <Bot class="w-6 h-6" />,
        //   onClick() {
        //     request.common.open_window.run({
        //       title: "控制台",
        //       route: "root.console",
        //     });
        //   },
        // },
        {
          title: "帮助",
          icon: <HelpCircle class="w-6 h-6" />,
          onClick() {
            request.common.open_window.run({
              title: "帮助中心/快捷键",
              route: "root.helper_center.shortcut",
            });
          },
        },
      ] as { title: string; icon: JSX.Element; badge?: boolean; url?: PageKeys; onClick?: () => void }[],
      $history: props.history,
    }),
  };

  let _state = {
    // get views() {
    //   return props.view.subViews;
    // },
    get menus() {
      return ui.$menu.state.menus;
    },
    get menus2() {
      return ui.$menu2.state.menus;
    },
    get cur_route_name() {
      return ui.$menu.state.route_name;
    },
  };
  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$menu.onStateChange(() => methods.refresh());
  // props.view.onSubViewsChange((v) => {
  //   bus.emit(Events.StateChange, { ..._state });
  //   // setSubViews(nextSubViews);
  // });
  // props.view.onCurViewChange((nextCurView) => {
  //   bus.emit(Events.StateChange, { ..._state });
  //   // setCurSubView(nextCurView);
  // });

  return {
    methods,
    state: _state,
    ready() {
      // methods.setCurMenu();
      bus.emit(Events.StateChange, { ..._state });
    },
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}

export const HomeLayout: ViewComponent = (props) => {
  const [state, vm] = useViewModel(HomeLayoutViewModel, [props]);

  return (
    <div class="flex w-full h-full">
      <div class="flex flex-col justify-between  border-r border-w-fg-3 bg-w-bg-1">
        <div class="relative z-10 p-2 space-y-2">
          <For each={state().menus}>
            {(menu) => {
              const { icon, url, badge, onClick } = menu;
              return (
                <Menu
                  class=""
                  app={props.app}
                  history={props.history}
                  highlight={state().cur_route_name === url}
                  url={url}
                  badge={badge}
                  onClick={onClick}
                >
                  {icon}
                </Menu>
              );
            }}
          </For>
        </div>
        <div class="relative z-10 p-2 space-y-2">
          <For each={state().menus2}>
            {(menu) => {
              const { icon, url, badge, onClick } = menu;
              return (
                <Menu
                  class=""
                  app={props.app}
                  history={props.history}
                  highlight={state().cur_route_name === url}
                  url={url}
                  badge={badge}
                  onClick={onClick}
                >
                  {icon}
                </Menu>
              );
            }}
          </For>
        </div>
      </div>
      <div class="z-0 flex-1 relative w-0 h-full">
        <RouteChildren
          app={props.app}
          client={props.client}
          storage={props.storage}
          pages={pages}
          history={props.history}
          view={props.view}
        />
      </div>
    </div>
  );
};

function Menu(
  props: Pick<ViewComponentProps, "app" | "history"> & {
    highlight?: boolean;
    url?: PageKeys;
    icon?: JSX.Element;
    badge?: boolean;
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const inner = (
    <div
      classList={{
        "relative flex items-center justify-center p-2 text-w-fg-0 cursor-pointer": true,
        "bg-w-brand": props.highlight,
      }}
      onClick={props.onClick}
    >
      <div class="z-10 relative flex flex-col items-center">
        {/* <div class="w-6 h-6">{props.icon}</div> */}
        <div class="relative inline-block">
          <div
            classList={{
              "text-w-fg-0": props.highlight,
              "text-w-fg-2": !props.highlight,
              "hover:text-w-fg-1": true,
            }}
          >
            {props.children}
          </div>
          {/* <Show when={props.badge}>
              <div class="absolute right-[-8px] top-0 w-2 h-2 rounded-full bg-red-500" />
            </Show> */}
        </div>
      </div>
    </div>
  );
  return (
    <Show when={props.url} fallback={inner}>
      <div
        classList={{
          [props.class || ""]: true,
        }}
        onClick={() => {
          if (!props.url) {
            return;
          }
          props.history.push(props.url);
          // props.app.showView(props.view);
        }}
      >
        {inner}
      </div>
    </Show>
  );
}
