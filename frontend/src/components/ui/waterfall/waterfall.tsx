/**
 * @file 支持多列的瀑布流组件
 */
import { For, JSX, Show } from "solid-js";

import { useViewModelStore } from "@/hooks";

import { WaterfallModel } from "@/domains/ui/waterfall/waterfall";
import { WaterfallColumnModel } from "@/domains/ui/waterfall/column";
import { WaterfallCellModel } from "@/domains/ui/waterfall/cell";
import { Keyed } from "@/components/keyed";

export function WaterfallView<T extends Record<string, unknown>>(
  props: {
    store: WaterfallModel<T>;
    // showFallback?: boolean;
    fallback?: JSX.Element;
    extra?: JSX.Element;
    render: (payload: T, idx: number) => JSX.Element;
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const [state, vm] = useViewModelStore(props.store);

  // console.log("[COMPONENT]ui/waterfall/waterfall - render", props.showFallback);

  return (
    <div
      class={props.class}
      classList={{
        "flex space-x-2": true,
      }}
    >
      {props.extra}
      <Show when={state().items.length} fallback={props.fallback}>
        <For each={state().columns}>
          {(column, idx) => {
            const $column = vm.$columns[idx()];
            if (!$column) {
              return null;
            }
            return <WaterfallColumnView store={$column} render={props.render} />;
          }}
        </For>
      </Show>
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
