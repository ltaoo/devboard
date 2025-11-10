import { findInnerTextNode, findNodeByPath, getNodePath } from "./op.dom";
import { SlatePoint } from "./point";
import { SlateEditorModel } from "./slate";
import { SlateDescendant, SlateDescendantType } from "./types";
import { isElement, isText } from "./utils/node";

export function connect(vm: SlateEditorModel, $input: Element) {
  document.addEventListener("selectionchange", (event) => {
    // console.log('addEventListener("selectionchange', vm.ui.$selection.dirty);
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
    const $start = findInnerTextNode(range.startContainer.parentNode) as HTMLDivElement | null;
    const $end = findInnerTextNode(range.endContainer.parentNode) as HTMLDivElement | null;
    // console.log("[]getCaretPosition - ", range.startContainer, $start, $end);
    if (!$start || !$end) {
      return;
    }
    // console.log("[]getCaretPosition - ", $start);
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
    const $node_start = findNodeByPath($input as Element, arg.start.path);
    const $node_end = findNodeByPath($input as Element, arg.start.path);
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
