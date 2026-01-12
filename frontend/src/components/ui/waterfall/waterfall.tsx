/**
 * @file 支持多列的瀑布流组件
 */
import { For, JSX, Match, Show, Switch } from "solid-js";

import { useViewModelStore } from "@/hooks";

import { WaterfallModel } from "@/domains/ui/waterfall/waterfall";
import { WaterfallColumnModel } from "@/domains/ui/waterfall/column";
import { WaterfallCellModel } from "@/domains/ui/waterfall/cell";
import { ListCore } from "@/domains/list";
import { ArrowDown, Bird, Loader } from "lucide-solid";

export function WaterfallView<T extends Record<string, unknown>>(
  props: {
    store: WaterfallModel<T>;
    list: ListCore<any>;
    fallback?: JSX.Element;
    /** 骨架屏 */
    skeleton?: JSX.Element;
    extra?: JSX.Element;
    render: (payload: T, idx: number) => JSX.Element;
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const [state, vm] = useViewModelStore(props.store);
  const [list, $list] = useViewModelStore(props.list);

  // console.log("[COMPONENT]ui/waterfall/waterfall - render", props.showFallback);

  return (
    <div class={props.class}>
      {props.extra}
      <Switch>
        <Match when={list().initial}>{props.skeleton}</Match>
        <Match when={list().error}>
          <div>{list().error?.message}</div>
        </Match>
        <Match when={state().items.length === 0}>
          <div class="w-full h-[360px] center flex items-center justify-center">
            <div class="flex flex-col items-center justify-center text-w-fg-1">
              <Bird class="w-24 h-24" />
              <div class="mt-4 flex items-center space-x-2">
                <Show when={list().loading}>
                  <Loader class="w-6 h-6 animate-spin" />
                </Show>
                <div class="text-center text-xl">{list().loading ? "" : "列表为空"}</div>
              </div>
            </div>
          </div>
        </Match>
        <Match when={state().items.length !== 0}>
          <div class="flex space-x-2">
            <For each={state().columns}>
              {(column, idx) => {
                const $column = vm.$columns[idx()];
                if (!$column) {
                  return null;
                }
                return <WaterfallColumnView store={$column} render={props.render} />;
              }}
            </For>
          </div>
          <Show
            when={list().noMore}
            fallback={
              <div class="mt-4 flex justify-center py-4 text-w-fg-1">
                <div
                  class="flex items-center space-x-2 cursor-pointer"
                  onClick={() => {
                    $list.loadMore();
                  }}
                >
                  <Show when={list().loading} fallback={<ArrowDown class="w-6 h-6" />}>
                    <Loader class="w-6 h-6 animate-spin" />
                  </Show>
                  <div class="text-center text-sm">{list().loading ? "" : "加载更多"}</div>
                </div>
              </div>
            }
          >
            <div class="mt-4 flex justify-center py-4 text-w-fg-1 text-sm">
              <div class="flex items-center space-x-2">
                <Show when={list().loading}>
                  <Loader class="w-6 h-6 animate-spin" />
                </Show>
                <div
                  class="text-center"
                  onClick={() => {
                    $list.loadMoreForce();
                  }}
                >
                  没有数据了
                </div>
              </div>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  );
}

export function WaterfallColumnView<T extends Record<string, unknown>>(props: {
  store: WaterfallColumnModel<T>;
  render: (payload: T, idx: number) => JSX.Element;
}) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div
      class="relative w-full"
      style={{
        height: `${state().height}px`,
      }}
    >
      {/* <Keyed each={state().items} by={(item) => item.id}>
        {(item, idx) => {
          const $cell = vm.$cells[idx()];
          return (
            <Show when={$cell}>
              <WaterfallCellView store={$cell!} idx={idx()} render={props.render} />
            </Show>
          );
        }}
      </Keyed> */}
      <For each={state().items}>
        {(cell, idx) => {
          const $cell = vm.$cells[idx()];
          return (
            <Show when={$cell} keyed={true}>
              <WaterfallCellView store={$cell!} idx={cell.idx} render={props.render} />
            </Show>
          );
        }}
      </For>
    </div>
  );
}

function WaterfallCellViewWrap<T extends Record<string, unknown>>(
  props: {
    store?: WaterfallCellModel<T>;
    idx: number;
    render: (payload: T, idx: number) => JSX.Element;
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  return (
    <Show when={props.store} keyed={true}>
      <WaterfallCellView store={props.store!} idx={props.idx} render={props.render} />
    </Show>
  );
}

export function WaterfallCellView<T extends Record<string, unknown>>(
  props: {
    store: WaterfallCellModel<T>;
    idx: number;
    render: (payload: T, idx: number) => JSX.Element;
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div
      class="__a absolute left-0 w-full"
      style={{ top: `${state().top}px` }}
      data-id={state().id}
      data-idx={props.idx}
      data-width={state().width}
      data-height={state().height}
      data-top={state().top}
      onAnimationEnd={(event) => {
        const { width, height } = event.currentTarget.getBoundingClientRect();
        // console.log("[COMPONENT]ui/waterfall/waterfall - WaterfallCellView onAnimationEnd", state().uid, width, height);
        // @todo 为什么会是 0？
        if (height === 0) {
          return;
        }
        vm.methods.load({ width, height });
      }}
    >
      {props.render(state().payload, props.idx)}
    </div>
  );
}
