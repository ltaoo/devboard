import { SlatePoint } from "./point";
import { SlateEditorModel } from "./slate";

export function connect(vm: SlateEditorModel, $input: Element) {
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
    if (!$input) {
      return;
    }
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
    // console.log("[]getCaretPosition - ", $start);
    if ($start === $input) {
      return;
    }
    const path_start = getNodePath($start, $input);
    const path_end = getNodePath($end, $input);
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
    const $node_start = findNodeWithPath($input as Element, arg.start.path);
    const $node_end = findNodeWithPath($input as Element, arg.start.path);
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
}

export function getNodePath(targetNode: Element, rootNode: Element) {
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
export function findNodeWithPath($elm: Element, path: number[]): Element | null {
  if (path.length === 0) {
    return $elm;
  }
  const $v = $elm.children[path[0]];
  if (!$v) {
    return null;
  }
  return findNodeWithPath($v, path.slice(1));
}

export function refreshSelection($editor: Element, start: SlatePoint, end: SlatePoint) {
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
