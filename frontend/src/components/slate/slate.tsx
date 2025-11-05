import { For, onMount } from "solid-js";

import { useViewModelStore } from "@/hooks";
import { Button } from "@/components/ui";

import { SlateEditorModel } from "@/biz/slate/slate";
import { SlateDescendant, SlateDescendantType, SlateOperationType } from "@/biz/slate/types";
import { SlatePoint } from "@/biz/slate/point";
import { ButtonCore } from "@/domains/ui";

export function SlateView(props: { store: SlateEditorModel }) {
  return <SlateEditable store={props.store} />;
}
// const TEXT_EMPTY_PLACEHOLDER = "&#x2060;<br>";
// const TEXT_EMPTY_PLACEHOLDER = "<br>";
const TEXT_EMPTY_PLACEHOLDER = "&nbsp;";
function SlateEditable(props: { store: SlateEditorModel }) {
  let $editor: HTMLDivElement | undefined;

  const [state, vm] = useViewModelStore(props.store);
  const [selection, $selection] = useViewModelStore(props.store.ui.$selection);

  function getNodePath(targetNode: Element, rootNode: Element) {
    const path = [];
    let currentNode = targetNode;

    // 从目标节点向上遍历直到根节点
    while (currentNode && currentNode !== rootNode) {
      const parent = currentNode.parentNode;
      if (!parent) break;

      // 获取当前节点在父节点中的索引
      const children = Array.from(parent.children);
      const index = children.indexOf(currentNode);

      if (index !== -1) {
        path.unshift(index); // 添加到路径开头
      }
      // @ts-ignore
      currentNode = parent;
    }

    return path;
  }
  function findNodeWithPath($elm: Element, path: number[]): Element | null {
    if (path.length === 0) {
      return $elm;
    }
    const $v = $elm.children[path[0]];
    if (!$v) {
      return null;
    }
    return findNodeWithPath($v, path.slice(1));
  }
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

  function applyCaretPosition($editor: Element, start: SlatePoint, end: SlatePoint) {
    //     const { start, end } = vm.ui.$selection.state;
    const $node_start = findNodeWithPath($editor as Element, start.path);
    const $node_end = findNodeWithPath($editor as Element, end.path);
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

    if (operation.type === SlateOperationType.InsertText) {
      const $target = findNodeWithPath($editor as Element, operation.path) as Element | null;
      console.log("[]vm.onAction - SlateOperationType.InsertText", $target, operation.path);
      if (!$target) {
        return;
      }
      if ($target.localName === "br") {
        $target.parentElement?.replaceChild(renderText(operation.node)!, $target);
      } else {
        $target.innerHTML = operation.wholeText;
      }
      applyCaretPosition($editor, vm.ui.$selection.start, vm.ui.$selection.end);
    }
    if (operation.type === SlateOperationType.DeleteText) {
      const $target = findNodeWithPath($editor as Element, operation.path) as Element | null;
      if (!$target) {
        return;
      }
      $target.innerHTML = operation.wholeText === "" ? TEXT_EMPTY_PLACEHOLDER : operation.wholeText;
      applyCaretPosition($editor, vm.ui.$selection.start, vm.ui.$selection.end);
    }
    if (operation.type === SlateOperationType.InsertLine) {
      const $node = renderElement(operation.node);
      if (!$node) {
        return;
      }
      let idx = operation.idx + 1;
      if (idx > $editor.children.length - 1) {
        $editor.appendChild($node);
      } else {
        $editor.insertBefore($node, $editor.children[idx]);
      }
      console.log("before apply ", vm.ui.$selection.start.path);
      applyCaretPosition($editor, vm.ui.$selection.start, vm.ui.$selection.end);
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
      if (selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);
      const $start = range.startContainer.parentNode as HTMLDivElement | null;
      const $end = range.endContainer.parentNode as HTMLDivElement | null;
      if (!$start || !$end) {
        return;
      }
      const offset_start = range.startOffset;
      const offset_end = range.endOffset;
      // const path_start = vm.methods.mapNodeWithKey($start.dataset["slate-node-key"]);
      // const path_end = vm.methods.mapNodeWithKey($end.dataset["slate-node-key"]);
      console.log("[]getCaretPosition - ", $start);
      if ($start === $editor) {
        return;
      }
      const path_start = getNodePath($start, $editor);
      const path_end = getNodePath($end, $editor);
      if (!path_start || !path_end) {
        return;
      }
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
    };
    vm.methods.setCaretPosition = function (arg: { start: SlatePoint; end: SlatePoint }) {
      const $node_start = findNodeWithPath($editor as Element, arg.start.path);
      const $node_end = findNodeWithPath($editor as Element, arg.start.path);
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
    const $elements = buildInnerHTML(vm.state.children);
    $editor.appendChild($elements);
    // console.log(innerHTML);
    // $editor.innerHTML = innerHTML;
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
        <div>
          Ln {selection().start.line}, Col {selection().start.offset}
        </div>
        <div>
          Ln {selection().end.line}, Col {selection().end.offset}
        </div>
        <div>{selection().collapsed ? "光标" : "选区"}</div>
      </div>
    </>
  );
}
