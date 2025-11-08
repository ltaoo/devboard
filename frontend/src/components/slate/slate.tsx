import { For, onMount } from "solid-js";

import { useViewModelStore } from "@/hooks";
import { Button } from "@/components/ui";

import { SlateEditorModel } from "@/biz/slate/slate";
import { SlateDescendant, SlateDescendantType, SlateOperationType } from "@/biz/slate/types";
import { SlatePoint } from "@/biz/slate/point";
import { ButtonCore } from "@/domains/ui";
import { connect } from "@/biz/slate/connect.web";
import {
  findNodeByPath,
  refreshSelection,
  getNodeText,
  formatText,
  renderLineNodesThenInsert,
  buildInnerHTML,
  SlateDOMOperations,
} from "@/biz/slate/op.dom";
import { deleteTextAtOffset, deleteTextInRange, insertTextAtOffset } from "@/biz/slate/utils/text";
import { isElement, isText } from "@/biz/slate/utils/node";
import { SlatePathModel } from "@/biz/slate/path";

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
      //       vm.methods.setCaretPosition();
    },
  });

  vm.onAction((operations) => {
    console.log("[]slate/slate.tsx - vm.onAction", operations.length);
    if (!$input) {
      return;
    }
    for (let i = 0; i < operations.length; i += 1) {
      const op = operations[i];
      console.log("[]slate/slate.tsx - vm.onAction", i, op.type);
      (() => {
        if (op.type === SlateOperationType.InsertText) {
          SlateDOMOperations.insertText($input, op);
          return;
        }
        if (op.type === SlateOperationType.RemoveText) {
          SlateDOMOperations.removeText($input, op);
          return;
        }
        if (op.type === SlateOperationType.InsertLines) {
          SlateDOMOperations.insertLines($input, op);
          return;
        }
        if (op.type === SlateOperationType.RemoveLines) {
          SlateDOMOperations.removeLines($input, op);
          return;
        }
        if (op.type === SlateOperationType.MergeNode) {
          SlateDOMOperations.mergeNode($input, op);
          return;
        }
        if (op.type === SlateOperationType.SplitNode) {
          SlateDOMOperations.splitNode($input, op);
          return;
        }
      })();
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
        style={{ "white-space": "pre-wrap" }}
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
      <div>
        <Button store={$btn}>测试</Button>
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
