import { For, onMount } from "solid-js";

import { useViewModelStore } from "@/hooks";
import { Button } from "@/components/ui";

import { SlateEditorModel } from "@/biz/slate/slate";
import { SlateOperationType } from "@/biz/slate/types";
import { ButtonCore } from "@/domains/ui";
import { connect } from "@/biz/slate/connect.web";
import { refreshSelection, buildInnerHTML, SlateDOMOperations } from "@/biz/slate/op.dom";

export function SlateView(props: { store: SlateEditorModel }) {
  return <SlateEditable store={props.store} />;
}

function SlateEditable(props: { store: SlateEditorModel }) {
  let $input: HTMLDivElement | undefined;

  const [state, vm] = useViewModelStore(props.store);
  const [selection, $selection] = useViewModelStore(props.store.ui.$selection);
  const [history, $history] = useViewModelStore(props.store.ui.$history);

  const $btn = new ButtonCore({
    onClick() {
      vm.ui.$selection.methods.setStartAndEnd({ start: { path: [0], offset: 0 }, end: { path: [0], offset: 0 } });
      vm.methods.emitSelectionChange({});
    },
  });
  const $btn_refresh = new ButtonCore({
    onClick() {
      vm.methods.refresh();
    },
  });

  vm.onAction((operations) => {
    if (!$input) {
      return;
    }
    for (let i = 0; i < operations.length; i += 1) {
      const op = operations[i];
      SlateDOMOperations.exec($input, op);
    }
  });
  vm.onSelectionChange(({ type, start, end }) => {
    if (!$input) {
      return;
    }
    refreshSelection($input, start, end);
  });
  onMount(() => {
    if (!$input) {
      return;
    }
    connect(vm, $input);
    const $elements = buildInnerHTML(vm.state.children);
    $input.appendChild($elements);
  });

  return (
    <>
      <div
        ref={$input}
        class="overflow-y-auto p-1 border border-2 border-w-fg-3 rounded-md outline-none"
        style={{ "white-space": "pre-wrap", "ime-mode": "disabled" }}
        // style=“ime-mode:disabled”
        contenteditable
        onBeforeInput={vm.methods.handleBeforeInput}
        onClick={vm.methods.handleClick}
        onInput={vm.methods.handleInput}
        onBlur={vm.methods.handleBlur}
        onFocus={vm.methods.handleFocus}
        onKeyDown={(event) => {
          vm.methods.handleKeyDown({
            code: event.code,
            preventDefault: event.preventDefault.bind(event),
            nativeEvent: event,
          });
        }}
        onKeyUp={(event) => {
          vm.methods.handleKeyUp({
            code: event.code,
            preventDefault: event.preventDefault.bind(event),
            nativeEvent: event,
          });
        }}
        onCompositionStart={vm.methods.handleCompositionStart}
        onCompositionUpdate={vm.methods.handleCompositionUpdate}
        onCompositionEnd={vm.methods.handleCompositionEnd}
      ></div>
      <div class="flex gap-2">
        <Button store={$btn}>测试</Button>
        <Button store={$btn_refresh}>刷新</Button>
      </div>
      <div class="flex gap-4">
        <div class="flex-1">
          <div>
            Ln {selection().start.line}, Col {selection().start.offset}
          </div>
          <div>
            Ln {selection().end.line}, Col {selection().end.offset}
          </div>
          <div>{selection().collapsed ? "光标" : "选区"}</div>
        </div>
        <div class="overflow-y-auto flex-1 max-h-[240px]">
          <For each={history().stacks}>
            {(stack) => {
              return (
                <div>
                  <div>{stack.type}</div>
                  <div class="text-[12px] text-w-fg-1">{stack.created_at}</div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <div class="text-[12px]">
        <pre>{state().JSON}</pre>
      </div>
    </>
  );
}
