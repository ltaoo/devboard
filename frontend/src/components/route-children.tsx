import { createSignal, For } from "solid-js";

import { pages } from "@/store/views";
import { PageKeys, ViewComponentProps } from "@/store/types";

import { RouteViewCore } from "@/domains/route_view";
import { cn } from "@/utils";

import { KeepAliveRouteView } from "./ui/keep-alive-route-view";

export function RouteChildren(props: ViewComponentProps) {
  const [views, setViews] = createSignal(props.view.subViews);

  props.view.onSubViewsChange((v) => setViews(v));

  return (
    <For each={views()}>
      {(subView, i) => {
        const routeName = subView.name;
        const PageContent = pages[routeName as Exclude<PageKeys, "root">];
        return (
          <KeepAliveRouteView class="absolute inset-0" app={props.app} store={subView} index={i()}>
            <PageContent
              app={props.app}
              client={props.client}
              storage={props.storage}
              pages={pages}
              history={props.history}
              view={subView}
            />
          </KeepAliveRouteView>
        );
      }}
    </For>
  );
}
