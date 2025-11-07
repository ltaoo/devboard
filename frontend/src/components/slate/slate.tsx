import { For, onMount } from "solid-js";

import { useViewModelStore } from "@/hooks";
import { Button } from "@/components/ui";

import { SlateEditorModel } from "@/biz/slate/slate";
import { SlateDescendant, SlateDescendantType, SlateOperationType } from "@/biz/slate/types";
import { SlatePoint } from "@/biz/slate/point";
import { ButtonCore } from "@/domains/ui";
import { findNodeWithPath, getNodePath, refreshSelection, connect } from "@/biz/slate/connect.web";
import { deleteTextAtOffset, deleteTextInRange, insertTextAtOffset } from "@/biz/slate/utils/text";
import { isElement, isText } from "@/biz/slate/utils/node";

export function SlateView(props: { store: SlateEditorModel }) {
  return <SlateEditable store={props.store} />;
}
// const TEXT_EMPTY_PLACEHOLDER = "&#8203;";
// const TEXT_EMPTY_PLACEHOLDER = "";
// const TEXT_EMPTY_PLACEHOLDER = "&#x2060;";
const TEXT_EMPTY_PLACEHOLDER = "<br>";
// const TEXT_EMPTY_PLACEHOLDER = "&nbsp;";

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
          const $target = findNodeWithPath($input as Element, op.path) as Element | null;
          if (!$target) {
            return;
          }
          console.log("[]vm.onAction - SlateOperationType.InsertText", $target.tagName, op.path, op.text);
          const t = insertTextAtOffset(getNodeText($target), op.text, op.offset);
          if ($target.tagName === "BR") {
            // $target.tagName = "SPAN";
            const $span = document.createElement("span");
            $span.innerHTML = t;
            $target.parentNode?.replaceChild($span, $target);
          } else {
            $target.innerHTML = t;
          }
          return;
        }
        if (op.type === SlateOperationType.RemoveText) {
          const $target = findNodeWithPath($input as Element, op.path) as Element | null;
          if (!$target) {
            return;
          }
          console.log("[]vm.onAction - SlateOperationType.DeleteText", $target.innerHTML, op.text);
          if (op.ignore || !op.text) {
            return;
          }
          $target.innerHTML = formatText(deleteTextAtOffset(getNodeText($target), op.text, op.offset));
          return;
        }
        if (op.type === SlateOperationType.InsertLines) {
          renderLineNodesThenInsert($input, op);
          return;
        }
        if (op.type === SlateOperationType.MergeNode) {
          const $node1 = findNodeWithPath($input as Element, op.point1.path) as Element | null;
          const $node2 = findNodeWithPath($input as Element, op.point2.path) as Element | null;
          if (!$node1 || !$node2) {
            return;
          }
          const text1 = getNodeText($node1);
          const text2 = getNodeText($node2);
          console.log("[]vm.onAction - SlateOperationType.MergeNode", $node1, $node2, text1, text2);
          const text = text1 + text2;
          $node1.innerHTML = formatText(text);
          const $line2 = findNodeWithPath($input as Element, [op.point2.path[0]]) as Element | null;
          //   $node2.parentNode?.removeChild($node2);
          if ($line2) {
            $line2.parentNode?.removeChild($line2);
          }
          return;
        }
        if (op.type === SlateOperationType.SplitNode) {
          const $node = findNodeWithPath($input as Element, op.path);
          if (!$node) {
            return;
          }
          const text = getNodeText($node);
          const text1 = text.slice(0, op.offset);
          $node.innerHTML = formatText(text1);
          renderNodeThenInsertLine($input, {
            node: op.node,
            path: [op.path[0]],
          });
        }
      })();
    }
  });
  vm.onSelectionChange(({ type, start, end }) => {
    if (!$input) {
      return;
    }
    //     if (type === SlateOperationType.InsertText) {
    //       return;
    //     }
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

function renderText(node: SlateDescendant & { key?: number }): Element | null {
  if (node.type === SlateDescendantType.Text) {
    const $text = document.createElement("span");
    $text.setAttribute("data-slate-node", "text");
    if (node.key) {
      $text.setAttribute("data-slate-node-key", String(node.key));
    }
    $text.innerHTML = formatText(node.text);
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
    if (isText(node)) {
      const $node = renderText(node);
      if ($node) {
        // lines.push($node);
        $tmp.appendChild($node);
      }
    }
    if (isElement(node)) {
      const $node = renderElement(node);
      if ($node) {
        // lines.push($node);
        $tmp.appendChild($node);
      }
    }
  }
  return $tmp;
}
function getNodeText($node: Element) {
  const v = $node.innerHTML;
  return formatInnerHTML(v);
}
function formatInnerHTML(v: string) {
  if (v === TEXT_EMPTY_PLACEHOLDER) {
    return "";
  }
  return v;
}
function formatText(v: string) {
  if (v === "") {
    return TEXT_EMPTY_PLACEHOLDER;
  }
  return v;
}
function renderNodeThenInsertLine($input: Element, op: { node: SlateDescendant; path: number[] }) {
  console.log("[SlateView]renderNodeThenInsertLine - ", op.node, op.path);
  const $node = renderElement(op.node);
  if (!$node) {
    return;
  }
  const idx = op.path[0] + 1;
  if (idx > $input.children.length - 1) {
    $input.appendChild($node);
  } else {
    console.log("[SlateView]renderNodeThenInsertLine - insertBefore", $node, $input.childNodes[idx]);
    $input.insertBefore($node, $input.children[idx]);
  }
}
function renderLineNodesThenInsert($input: Element, op: { node: SlateDescendant[]; path: number[] }) {
  console.log("[SlateView]renderNodeThenInsertLine - ", op.node, op.path);
  const $tmp = document.createDocumentFragment();
  for (let i = 0; i < op.node.length; i += 1) {
    const $node = renderElement(op.node[i]);
    if ($node) {
      $tmp.appendChild($node);
    }
  }
  const idx = op.path[0] + 1;
  if (idx > $input.children.length - 1) {
    $input.appendChild($tmp);
  } else {
    console.log("[SlateView]renderNodeThenInsertLine - insertBefore", $input.childNodes[idx]);
    $input.insertBefore($tmp, $input.children[idx]);
  }
}
