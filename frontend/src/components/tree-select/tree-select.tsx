import { For, Show } from "solid-js";

import { useViewModelStore } from "@/hooks";

import { TreeSelectModel, TreeSelectNodeModel } from "@/domains/ui/tree-select/tree-select";

export function TreeSelect<T extends { id: number; label: string; children?: T[] }>(props: {
  store: TreeSelectModel<T>;
}) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div>
      <For each={state().nodes}>
        {(cate, idx) => {
          const $node = vm.methods.mapNode(idx());
          return <TreeSelectNode {...cate} store={$node} />;
        }}
      </For>
    </div>
  );
}

export function TreeSelectNode<T extends { id: number; label: string; children?: T[] }>(props: {
  store: TreeSelectNodeModel<T>;
}) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div>
      <div class="flex items-center gap-2">
        <div class="">{state().node.label}</div>
        <Show when={state().children?.length === 0}>
          <input
            checked={vm.methods.isChecked()}
            type="checkbox"
            onChange={(e) => {
              vm.methods.handleChange({ checked: e.currentTarget.checked });
            }}
          />
        </Show>
      </div>
      <div class="pl-4">
        <TreeSelect store={vm.ui.$children} />
        {/* <For each={props.children}>
		{(child) => {
		  return <CategoryNodeView {...child} onChange={props.onChange} />;
		}}
	      </For> */}
      </div>
    </div>
  );
}
