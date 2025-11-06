import { For, onMount } from "solid-js";

import { useViewModelStore } from "@/hooks";
import { Button } from "@/components/ui";

import { SlateEditorModel } from "@/biz/slate/slate";
import { SlateDescendant, SlateDescendantType, SlateOperationType } from "@/biz/slate/types";
import { SlatePoint } from "@/biz/slate/point";
import { ButtonCore } from "@/domains/ui";
import { findNodeWithPath, getNodePath, applyCaretPosition, connect } from "@/biz/slate/connect.web";
import { deleteTextAtOffset, deleteTextInRange, insertTextAtOffset } from "@/biz/slate/utils/text";

export function SlateView(props: { store: SlateEditorModel }) {
  return <SlateEditable store={props.store} />;
}
// const TEXT_EMPTY_PLACEHOLDER = "&#x2060;<br>";
// const TEXT_EMPTY_PLACEHOLDER = "<br>";
const TEXT_EMPTY_PLACEHOLDER = "&nbsp;";

function SlateEditable(props: { store: SlateEditorModel }) {
  let $input: HTMLDivElement | undefined;

  const [state, vm] = useViewModelStore(props.store);
  const [selection, $selection] = useViewModelStore(props.store.ui.$selection);
  const [history, $history] = useViewModelStore(props.store.ui.$history);

  function renderText(node: SlateDescendant & { key?: number }): Element | null {
    if (node.type === SlateDescendantType.Text) {
      const $text = document.createElement("span");
      $text.setAttribute("data-slate-node", "text");
      if (node.key) {
        $text.setAttribute("data-slate-node-key", String(node.key));
      }
      if (node.text === "") {
        $text.innerHTML = TEXT_EMPTY_PLACEHOLDER;
      } else {
        $text.innerText = node.text;
      }
      return $text;
    }
    return null;
  }
  function renderElement(node: SlateDescendant & { key?: number }): Element | null {
    if (node.type === SlateDescendantType.Paragraph) {
      const $node = document.createElement("p");
      $node.setAttribute("data-slate-node", "element");
      if (node.key) {
        $node.setAttribute("data-slate-node-key", String(node.key));
      }
      const $tmp = document.createDocumentFragment();
      for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];
        if (child.type === SlateDescendantType.Text) {
          const $child = renderText(node.children[i]);
          if ($child) {
            $tmp.appendChild($child);
          }
        }
        if (child.type === SlateDescendantType.Paragraph) {
          const $child = renderElement(node.children[i]);
          if ($child) {
            $tmp.appendChild($child);
          }
        }
      }
      $node.appendChild($tmp);
      return $node;
    }
    return null;
  }
  function buildInnerHTML(nodes: SlateDescendant[], parents: number[] = [], level = 0) {
    // let lines: Element[] = [];
    const $tmp = document.createDocumentFragment();
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const path = [...parents, i].filter((v) => v !== undefined).join("_");
      if (vm.methods.isText(node)) {
        const $node = renderText(node);
        if ($node) {
          // lines.push($node);
          $tmp.appendChild($node);
        }
      }
      if (vm.methods.isElement(node)) {
        const $node = renderElement(node);
        if ($node) {
          // lines.push($node);
          $tmp.appendChild($node);
        }
      }
    }
    return $tmp;
  }
  const $btn = new ButtonCore({
    onClick() {
      //       vm.methods.setCaretPosition();
    },
  });

  vm.onAction((operations) => {
    if (!$input) {
      return;
    }
    for (let i = 0; i < operations.length; i += 1) {
      const op = operations[i];
      if (op.type === SlateOperationType.InsertText) {
        const $target = findNodeWithPath($input as Element, op.path) as Element | null;
        if (!$target) {
          return;
        }
        console.log("[]vm.onAction - SlateOperationType.InsertText", $target.innerHTML, op.text);
        $target.innerHTML = insertTextAtOffset($target.innerHTML, op.text, op.offset);
      }
      if (op.type === SlateOperationType.RemoveText) {
        const $target = findNodeWithPath($input as Element, op.path) as Element | null;
        if (!$target) {
          return;
        }
        console.log("[]vm.onAction - SlateOperationType.DeleteText", $target.innerHTML, op.text, op.offset);
        const nextText = deleteTextAtOffset($target.innerHTML, op.text, op.offset);
        $target.innerHTML = nextText === "" ? TEXT_EMPTY_PLACEHOLDER : nextText;
      }
      if (op.type === SlateOperationType.InsertLine) {
        const $node = renderElement(op.node);
        if (!$node) {
          return;
        }
        const idx = op.path[0] + 1;
        if (idx > $input.children.length - 1) {
          $input.appendChild($node);
        } else {
          $input.insertBefore($node, $input.children[idx]);
        }
      }
    }
  });
  vm.onSelectionChange(({ start, end }) => {
    if (!$input) {
      return;
    }
    applyCaretPosition($input, start, end);
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
    </>
  );
}
