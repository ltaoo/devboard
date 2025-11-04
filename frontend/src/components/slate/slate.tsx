import { useViewModelStore } from "@/hooks";

import { SlateEditorModel } from "@/biz/slate/slate";

export function SlateView(props: { store: SlateEditorModel }) {
  return <SlateEditable store={props.store} />;
}

function SlateEditable(props: { store: SlateEditorModel }) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <div
      class="overflow-y-auto min-h-[200px] p-1 border border-2 border-w-fg-3 rounded-md whitespace-pre outline-none"
      contenteditable
      onBeforeInput={vm.methods.handleBeforeInput}
      onClick={vm.methods.handleClick}
      onInput={vm.methods.handleInput}
      onBlur={vm.methods.handleBlur}
      onFocus={vm.methods.handleFocus}
      onKeyDown={(event) => {
        vm.methods.handleKeyDown({
          nativeEvent: event,
        });
      }}
      onCompositionStart={vm.methods.handleCompositionStart}
      onCompositionUpdate={vm.methods.handleCompositionUpdate}
      onCompositionEnd={vm.methods.handleCompositionEnd}
    ></div>
  );
}
