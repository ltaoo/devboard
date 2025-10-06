import { For, JSX, Show } from "solid-js";

import { useViewModelStore } from "@/hooks";

import { TreeSelectModel, TreeSelectNodeModel } from "@/domains/ui/tree-select/tree-select";
import { Edit, Plus, Trash } from "lucide-solid";
import { Input, Popover } from "../ui";

export function TreeEdit<T extends { id: number | string; label: string; children?: T[] }>(props: {
  store: TreeSelectModel<T>;
  renderNode: (v: { level: number; idx: number; uid: string; node: T }) => JSX.Element;
}) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div>
      <For each={state().nodes}>
        {(cate, idx) => {
          const $node = vm.methods.mapNode(idx());
          return <TreeEditNode {...cate} store={$node} renderNode={props.renderNode} />;
        }}
      </For>
      {/* <Show when={state().nodes.length}>
        <input />
      </Show> */}
      {/* <input /> */}
    </div>
  );
}

export function TreeEditNode<T extends { id: number | string; label: string; children?: T[] }>(props: {
  store: TreeSelectNodeModel<T>;
  renderNode: (v: { level: number; idx: number; uid: string; node: T }) => JSX.Element;
}) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div>
      <div class="flex items-center gap-2">
        {props.renderNode({ level: state().level, idx: state().idx, uid: state().uid, node: state().node })}
        {/* <input
          checked={vm.methods.isChecked()}
          type="checkbox"
          onChange={(e) => {
            vm.methods.handleChange({ checked: e.currentTarget.checked });
          }}
        /> */}
      </div>
      <div class="pl-4">
        <div class="nodes">
          <TreeEdit store={vm.ui.$children} renderNode={props.renderNode} />
        </div>
        {/* <For each={props.children}>
		{(child) => {
		  return <CategoryNodeView {...child} onChange={props.onChange} />;
		}}
	      </For> */}
      </div>
    </div>
  );
}
