import { For, onMount } from "solid-js";

import { useViewModelStore } from "@/hooks";
import { Button } from "@/components/ui";

import { SlateDescendant, SlateEditorModel } from "@/biz/slate/slate";
import { SlatePoint } from "@/biz/slate/point";
import { ButtonCore } from "@/domains/ui";

export function SlateView(props: { store: SlateEditorModel }) {
  return <SlateEditable store={props.store} />;
}

function SlateEditable(props: { store: SlateEditorModel }) {
  let $editor: HTMLDivElement | undefined;

  const [state, vm] = useViewModelStore(props.store);
  const [selection, $selection] = useViewModelStore(props.store.ui.$selection);

  function findNodeWithPath($elm: Element, path: number[]) {
    if (path.length === 0) {
      return $elm;
    }
    const $v = $elm.children[path[0]];
    if (!$v) {
      return null;
    }
    return findNodeWithPath($v, path.slice(1));
  }
  function buildInnerHTML(nodes: SlateDescendant[], parents: number[] = [], level = 0) {
    let lines: string[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const path = [...parents, i].filter((v) => v !== undefined).join("_");
      if (vm.methods.isText(node)) {
        const v = `<span data-level="${level}" data-idx="${i}" data-path="${path}">${node.text}</span>`;
        lines.push(v);
      }
      if (vm.methods.isElement(node)) {
        const inner = buildInnerHTML(node.children, [...parents, i], level + 1);
        const v = `<div data-level="${level}" data-idx="${i}" data-path="${path}">${inner}</div>`;
        lines.push(v);
      }
    }
    return lines.join("");
  }

  function applyCaretPosition($editor: Element, start: SlatePoint, end: SlatePoint) {
    //     const { start, end } = vm.ui.$selection.state;
    const $node_start = findNodeWithPath($editor, start.path) as Element | null;
    const $node_end = findNodeWithPath($editor, end.path) as Element | null;
    if (!$node_start || !$node_end) {
      return;
    }
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.setStart($node_start.childNodes[0], start.offset);
    range.setEnd($node_end.childNodes[0], end.offset);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const $btn = new ButtonCore({
    onClick() {
      //       vm.methods.setCaretPosition();
    },
  });

  vm.onAction((operation) => {
    if (!$editor) {
      return;
    }
    const $target = findNodeWithPath($editor, operation.path) as Element | null;
//     console.log("[] vm.onAction after findNodeWithPath", operation, $target);
    if (!$target) {
      return;
    }
    if (operation.type === "insert_text") {
      $target.innerHTML = operation.wholeText;
      applyCaretPosition($editor, vm.ui.$selection.state.start, vm.ui.$selection.state.end);
      setTimeout(() => {
        // vm.methods.getCaretPosition();
        //       vm.methods.refreshSelection();
      }, 100);
    }
    if (operation.type === "delete_text") {
      $target.innerHTML = operation.wholeText;
      setTimeout(() => {
        applyCaretPosition($editor, vm.ui.$selection.state.start, vm.ui.$selection.state.end);
        // vm.methods.getCaretPosition();
        //       vm.methods.refreshSelection();
      }, 0);
    }
  });
  onMount(() => {
    if (!$editor) {
      return;
    }
    document.addEventListener("selectionchange", (event) => {
//       console.log('addEventListener("selectionchange', vm.ui.$selection.dirty);
//       if (vm.ui.$selection.dirty) {
//         return;
//       }
      vm.methods.handleSelectionChange();
    });
    // $editor.addEventListener("mouseup", (event) => {
    //   vm.methods.getCaretPosition();
    // });
    vm.methods.getCaretPosition = function () {
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
//       console.log("[]get caret position - ", selection.rangeCount);
      if (selection.rangeCount === 0) {
        return 0;
      }
      const range = selection.getRangeAt(0);
//       console.log(range);
      const $start = range.startContainer.parentNode as HTMLDivElement | null;
      const $end = range.endContainer.parentNode as HTMLDivElement | null;
      if (!$start || !$end) {
        return;
      }
      const path_start = $start.dataset["path"]?.split("_").map((v) => Number(v)) ?? [];
      const path_end = $end.dataset["path"]?.split("_").map((v) => Number(v)) ?? [];
      const offset_start = range.startOffset;
      const offset_end = range.endOffset;
      vm.ui.$selection.methods.handleChange({
        start: {
          path: path_start,
          offset: offset_start,
        },
        end: {
          path: path_end,
          offset: offset_end,
        },
        collapsed: range.collapsed,
      });
      return 0;
    };
    vm.methods.setCaretPosition = function (arg: { start: SlatePoint; end: SlatePoint }) {
      const $node_start = findNodeWithPath($editor, arg.start.path) as Element | null;
      const $node_end = findNodeWithPath($editor, arg.start.path) as Element | null;
      if (!$node_start || !$node_end) {
        return;
      }
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStart($node_start.childNodes[0], arg.start.offset);
      range.setEnd($node_end.childNodes[0], arg.end.offset);
      selection.removeAllRanges();
      selection.addRange(range);
    };
    const innerHTML = buildInnerHTML(vm.state.children);
    console.log(innerHTML);
    $editor.innerHTML = innerHTML;
  });

  return (
    <>
      <div
        ref={$editor}
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
      <div>
        <div>{selection().start.offset}</div>
        <div>{selection().end.offset}</div>
        <div>{selection().collapsed ? "光标" : "选区"}</div>
      </div>
    </>
  );
}
