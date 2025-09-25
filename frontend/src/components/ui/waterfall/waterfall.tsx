/**
 * @file 支持多列的瀑布流组件
 */
import { For, JSX, Show } from "solid-js";

import { useViewModelStore } from "@/hooks";

import { WaterfallModel } from "@/domains/ui/waterfall/waterfall";
import { WaterfallColumnModel } from "@/domains/ui/waterfall/column";
import { WaterfallCellModel } from "@/domains/ui/waterfall/cell";

export function WaterfallView<T>(
  props: {
    store: WaterfallModel<T>;
    fallback?: JSX.Element;
    render: (payload: T) => JSX.Element;
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div
      class={props.class}
      classList={{
        "flex space-x-2": true,
      }}
    >
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

export function WaterfallColumnView<T>(props: { store: WaterfallColumnModel<T>; render: (payload: T) => JSX.Element }) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div
      class="relative w-full"
      style={{
        height: `${state().height}px`,
      }}
    >
      <For each={state().items}>
        {(cell, idx) => {
          // const v = cell.payload;
          const $cell = vm.$cells[idx()];
          if (!$cell) {
            return null;
          }
          return <WaterfallCellView store={$cell} render={props.render} />;
        }}
      </For>
    </div>
  );
}

export function WaterfallCellView<T>(
  props: { store: WaterfallCellModel<T>; render: (payload: T) => JSX.Element } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div
      class="__a absolute left-0 w-full"
      style={{ top: `${state().top}px` }}
      data-id={state().id}
      data-idx={state().idx}
      data-width={state().width}
      data-height={state().height}
      onAnimationEnd={(event) => {
        console.log("[COMPONENT]ui/waterfall/waterfall - WaterfallCellView onAnimationEnd", state().id);
        const { width, height } = event.currentTarget.getBoundingClientRect();
        vm.methods.load({ width, height });
      }}
    >
      {props.render(state().payload)}
    </div>
  );
}
