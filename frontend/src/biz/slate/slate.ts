import { ViewComponentProps } from "@/store/types";
import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { ShortcutModel } from "@/biz/shortcut/shortcut";
import { uidFactory } from "@/utils";

import { SlatePoint, SlatePointModel } from "./point";
import { SlateSelectionModel } from "./selection";
import {
  SlateText,
  SlateParagraph,
  SlateDescendant,
  SlateNode,
  SlateOperation,
  SlateDescendantType,
  SlateOperationType,
} from "./types";
import { SlateHistoryModel } from "./history";
import { isObject } from "./utils/is-object";
import { deleteTextAtOffset, deleteTextInRange, insertTextAtOffset } from "./utils/text";
import { depthFirstSearch } from "./utils/node";
import { SlateNodeOperations, findNodeByPath } from "./op.node";
import { SlatePathModel } from "./path";

type BeforeInputEvent = {
  preventDefault(): void;
  data: unknown;
};
type BlurEvent = {};
type FocusEvent = {};
type CompositionEndEvent = {
  data: unknown;
  preventDefault(): void;
};
type CompositionUpdateEvent = {
  preventDefault(): void;
};
type CompositionStartEvent = {
  preventDefault(): void;
};
type KeyDownEvent = {
  code: string;
  preventDefault(): void;
  nativeEvent: {
    isComposing: boolean;
  };
};

type TextInsertTextOptions = {
  //   at?: Location;
  at?: any;
  voids?: boolean;
};

export function SlateEditorModel(props: { defaultValue?: SlateDescendant[]; app: ViewComponentProps["app"] }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    emitSelectionChange(v: { type?: SlateOperationType }) {
      bus.emit(Events.SelectionChange, {
        type: v.type,
        start: ui.$selection.start,
        end: ui.$selection.end,
      });
    },
    apply(operations: SlateOperation[]) {
      ui.$history.methods.push(operations, { start: ui.$selection.start, end: ui.$selection.end });
      bus.emit(Events.Action, operations);
    },
    findNodeByPath(path: number[]) {
      let i = 0;
      let n = _children[path[i]];
      while (i < path.length - 1) {
        i += 1;
        // @ts-ignore
        n = n.children?.[path[i]];
        // console.log(i, n);
      }
      return n;
    },
    getDefaultInsertLocation() {
      return [0];
    },
    //     point(at, extra: Partial<{ edge: "start" | "end" }> = {}) {
    //       const { edge = "start" } = extra;
    //     },
    //     start(at) {
    //       return methods.point(at, { edge: "start" });
    //     },
    //     end(to) {},
    //     range(at, to) {
    //       return {
    //         anchor: methods.start(at),
    //         focus: methods.end(to || at),
    //       };
    //     },
    /** 输入文本内容 */
    insertText(text: string, options: TextInsertTextOptions = {}) {
      let start = ui.$selection.start;
      let end = ui.$selection.end;
      const node1 = methods.findNodeByPath(start.path) as SlateDescendant | null;
      // console.log("[]insertText", start, end);
      if (!node1 || node1.type !== SlateDescendantType.Text) {
        return;
      }
      // console.log("[]insertText - is same point", start, end);
      let is_finish_composing = false;
      if (_start_before_composing && _end_before_composing) {
        ui.$selection.methods.setStartAndEnd({ start: _start_before_composing, end: _end_before_composing });
        is_finish_composing = true;
        _start_before_composing = null;
        _end_before_composing = null;
      }
      start = ui.$selection.start;
      end = ui.$selection.end;
      const original_text = node1.text;
      const inserted_text = text;
      if ([" ", "，", "。", "；"].includes(inserted_text)) {
        ui.$history.methods.mark();
      }
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      if (is_same_point) {
        const op_insert_text: SlateOperation = {
          type: SlateOperationType.InsertText,
          text: inserted_text,
          original_text,
          path: start.path,
          offset: start.offset,
        };
        _children = SlateNodeOperations.exec(_children, op_insert_text);
        methods.apply([op_insert_text]);
        ui.$selection.methods.moveForward({ step: text.length });
        methods.emitSelectionChange({
          type: SlateOperationType.InsertText,
        });
        return;
      }
      if (!SlatePathModel.isSameParent(start.path, end.path)) {
        // 跨行输入，先删除 start end 两行的选中部分，然后删除 start end 中间可能存在的行，然后合并 start end 行，最后插入输入的文本
        const node2 = findNodeByPath(_children, end.path);
        if (node2 && node2.type === SlateDescendantType.Text) {
          const ops: SlateOperation[] = [];
          const { op_start_delete_text, op_end_delete_text } = methods.removeContentCrossLines(
            node1,
            node2,
            start,
            end
          );
          _children = SlateNodeOperations.exec(_children, op_start_delete_text);
          _children = SlateNodeOperations.exec(_children, op_end_delete_text);
          ops.push(op_start_delete_text);
          ops.push(op_end_delete_text);
          const remove_line_maybe = methods.removeLinesCrossLines(start, end);
          if (remove_line_maybe) {
            _children = SlateNodeOperations.exec(_children, remove_line_maybe.op_remove_lines);
            ops.push(remove_line_maybe.op_remove_lines);
          }
          const op_merge_node: SlateOperation = {
            type: SlateOperationType.MergeNode,
            path: start.path,
            offset: start.offset,
            start: start,
            end: remove_line_maybe ? remove_line_maybe.end : end,
          };
          _children = SlateNodeOperations.exec(_children, op_merge_node);
          ops.push(op_merge_node);
          const op_insert_text: SlateOperation = {
            type: SlateOperationType.InsertText,
            text: inserted_text,
            original_text,
            path: start.path,
            offset: start.offset,
          };
          _children = SlateNodeOperations.exec(_children, op_insert_text);
          ops.push(op_insert_text);
          methods.apply(ops);
          ui.$selection.methods.collapseToOffset({ offset: start.offset + inserted_text.length });
          methods.emitSelectionChange({
            type: SlateOperationType.Unknown,
          });
          return;
        }
      }
      // const range = [start.offset, end.offset] as [number, number];
      // ui.$selection.methods.moveForward({ step: text.length, collapse: true });
      const deleted_text = original_text.substring(start.offset, end.offset);
      fmt.Println("[]insertText - 188", original_text, deleted_text, node1.text);
      // node1.text = insertTextAtOffset(deleteTextInRange(original_text, range), inserted_text, range[0]);
      const ops: SlateOperation[] = [];
      const op_remove_text1: SlateOperation = {
        type: SlateOperationType.RemoveText,
        // 先选择再输入中文的场景，如 hello 选择 ell，再输入，$target.innerHTML 是 ho，所以不能再删除任何内容了
        ignore: is_finish_composing,
        text: deleted_text,
        original_text,
        path: start.path,
        offset: start.offset,
      };
      ops.push(op_remove_text1);
      _children = SlateNodeOperations.exec(_children, op_remove_text1);
      const op_insert_text: SlateOperation = {
        type: SlateOperationType.InsertText,
        text: inserted_text,
        original_text,
        path: start.path,
        offset: start.offset,
      };
      ops.push(op_insert_text);
      _children = SlateNodeOperations.exec(_children, op_insert_text);
      methods.apply([op_insert_text]);
      ui.$selection.methods.collapseToOffset({ offset: start.offset + inserted_text.length });
      methods.emitSelectionChange({
        type: SlateOperationType.InsertText,
      });
      // fmt.Println("[]insertText - before InsertText", inserted_text);
    },
    /** 前面新增行 */
    insertLineBefore() {
      const { start } = ui.$selection;
      const line_idx = start.path[0];
      // const created_node = {} as SlateDescendant;
      // console.log("[]slate/slate - insertLineBefore _children", _children);
      const op_insert_lines: SlateOperation = {
        type: SlateOperationType.InsertLines,
        node: [
          {
            key: uid(),
            type: SlateDescendantType.Paragraph,
            children: [{ type: SlateDescendantType.Text, text: "" }],
          },
        ],
        path: [line_idx - 1],
      };
      _children = SlateNodeOperations.exec(_children, op_insert_lines);
      methods.apply([op_insert_lines]);
      ui.$selection.methods.moveToNextLineHead();
      methods.emitSelectionChange({
        type: SlateOperationType.InsertLines,
      });
    },
    /** 后面新增行 */
    insertLineAfter() {
      const { start, end } = ui.$selection;
      // _children = [..._children.slice(0, line_idx + 1), created_node, ..._children.slice(line_idx + 1)];
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      console.log("[]slate/slate - insertLineAfter", is_same_point, start, end);
      const ops: SlateOperation[] = [];
      if (!is_same_point) {
        // 选中部分选取，然后回车
        // @todo 还要考虑跨行的场景
        const node = findNodeByPath(_children, start.path);
        if (node && node.type === SlateDescendantType.Text) {
          const original_text = node.text;
          const deleted_text = original_text.substring(start.offset, end.offset);
          const op_remove_text: SlateOperation = {
            type: SlateOperationType.RemoveText,
            text: deleted_text,
            original_text,
            path: start.path,
            offset: start.offset,
          };
          _children = SlateNodeOperations.exec(_children, op_remove_text);
          ops.push(op_remove_text);
        }
      }
      const op_insert_lines: SlateOperation = {
        type: SlateOperationType.InsertLines,
        node: [
          {
            key: uid(),
            type: SlateDescendantType.Paragraph,
            children: [{ type: SlateDescendantType.Text, text: "" }],
          },
        ],
        path: start.path,
      };
      ops.push(op_insert_lines);
      _children = SlateNodeOperations.exec(_children, op_insert_lines);
      methods.apply(ops);
      ui.$selection.methods.moveToNextLineHead();
      methods.emitSelectionChange({
        type: SlateOperationType.InsertLines,
      });
    },
    /** 拆分当前行 */
    splitLine() {
      const { start, end } = ui.$selection;
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      if (is_same_point) {
        const next_selection = ui.$selection.methods.calcNextLineHead();
        const op_split_node: SlateOperation = {
          type: SlateOperationType.SplitNode,
          path: start.path,
          offset: start.offset,
          start: next_selection.start,
          end: next_selection.end,
        };
        // console.log("[]Before SplitNode op");
        console.log("[]slate/slate - splitLine", _children);
        _children = SlateNodeOperations.exec(_children, op_split_node);
        methods.apply([op_split_node]);
        // 这里不能放到 apply 前面，因为 apply 时要取当前光标位置，用于 Undo 操作
        // 提前了，拿到的就是 apply 后的光标位置了
        ui.$selection.methods.setStartAndEnd(next_selection);
        methods.emitSelectionChange({
          type: SlateOperationType.SplitNode,
        });
        return;
      }
      // 选择部分内容后，输入回车进行拆分行
      const node1 = methods.findNodeByPath(start.path);
      const node2 = methods.findNodeByPath(end.path);
      if (!node1 || node1.type !== SlateDescendantType.Text || !node2 || node2.type !== SlateDescendantType.Text) {
        return;
      }
      if (SlatePathModel.isSameParent(start.path, end.path)) {
        const original_text1 = node1.text;
        const deleted_text1 = original_text1.substring(start.offset, end.offset);
        // const text1 = original_text.slice(0, start.offset);
        // const text2 = original_text.slice(end.offset);
        // node1.text = text1;
        const ops: SlateOperation[] = [];
        const op_remove_text: SlateOperation = {
          type: SlateOperationType.RemoveText,
          text: deleted_text1,
          original_text: original_text1,
          path: start.path,
          offset: start.offset,
        };
        ops.push(op_remove_text);
        _children = SlateNodeOperations.exec(_children, op_remove_text);
        const next_selection = ui.$selection.methods.calcNextLineHead();
        const op_split_node: SlateOperation = {
          type: SlateOperationType.SplitNode,
          path: start.path,
          offset: start.offset,
          start: next_selection.start,
          end: next_selection.end,
        };
        ops.push(op_split_node);
        _children = SlateNodeOperations.exec(_children, op_split_node);
        methods.apply(ops);
        ui.$selection.methods.setStartAndEnd(next_selection);
        methods.emitSelectionChange({
          type: SlateOperationType.SplitNode,
        });
        return;
      }
      // 跨节点回车删除内容并拆分行
      const ops: SlateOperation[] = [];
      const { op_start_delete_text, op_end_delete_text } = methods.removeContentCrossLines(node1, node2, start, end);
      _children = SlateNodeOperations.exec(_children, op_start_delete_text);
      _children = SlateNodeOperations.exec(_children, op_end_delete_text);
      ops.push(op_start_delete_text);
      ops.push(op_end_delete_text);
      const remove_line_maybe = methods.removeLinesCrossLines(start, end);
      if (remove_line_maybe) {
        _children = SlateNodeOperations.exec(_children, remove_line_maybe.op_remove_lines);
        ops.push(remove_line_maybe.op_remove_lines);
      }
      const next_selection = ui.$selection.methods.calcNextLineHead();
      const op_split_node: SlateOperation = {
        type: SlateOperationType.SplitNode,
        path: start.path,
        offset: start.offset,
        start: next_selection.start,
        end: remove_line_maybe ? remove_line_maybe.end : next_selection.end,
      };
      ops.push(op_split_node);
      _children = SlateNodeOperations.exec(_children, op_split_node);
      methods.apply(ops);
      ui.$selection.methods.setStartAndEnd(next_selection);
      methods.emitSelectionChange({
        type: SlateOperationType.SplitNode,
      });
    },
    mergeLines(start: SlatePoint) {
      console.log("[]mergeLines", start);
      // 需要合并两行
      const prev_line_last_node = SlateSelectionModel.getLineLastNode(_children, start.path[0] - 1);
      const cur_line_last_node = SlateSelectionModel.getLineFirstNode(_children, start.path[0]);
      const target_point_after_merge = SlateSelectionModel.getLineLastPoint(_children, start.path[0] - 1);
      // if (
      //   prev_line_last_node.node.type === SlateDescendantType.Text &&
      //   cur_line_last_node.node.type === SlateDescendantType.Text
      // ) {
      //   prev_line_last_node.node.text = prev_line_last_node.node.text + cur_line_last_node.node.text;
      //   _children = SlateSelectionModel.removeLine(_children, start.path[0]);
      // }
      const op_merge_node: SlateOperation = {
        type: SlateOperationType.MergeNode,
        path: prev_line_last_node.path,
        offset: prev_line_last_node.offset,
        start: cur_line_last_node,
        end: cur_line_last_node,
      };
      _children = SlateNodeOperations.exec(_children, op_merge_node);
      // console.log("[]slate/slate - deleteBackward - merge node", _children[start.path[0] - 1]);
      methods.apply([op_merge_node]);
      // console.log("[]slate/slate - deleteBackward - selection point", target_point_after_merge);
      ui.$selection.methods.setStartAndEnd({ start: target_point_after_merge, end: target_point_after_merge });
      methods.emitSelectionChange({
        type: SlateOperationType.MergeNode,
      });
    },
    removeLines(start: SlatePoint) {
      const node = findNodeByPath(_children, [start.path[0]]);
      if (node) {
        const op_remove_lines: SlateOperation = {
          type: SlateOperationType.RemoveLines,
          node: [node as SlateDescendant & { key: number }],
          path: start.path,
        };
        _children = SlateNodeOperations.exec(_children, op_remove_lines);
        methods.apply([op_remove_lines]);
        ui.$selection.methods.moveToPrevLineHead();
        methods.emitSelectionChange({ type: SlateOperationType.RemoveLines });
      }
    },
    /** 删除指定位置的文本 */
    removeText(node: SlateText, point: SlatePoint) {
      const original_text = node.text;
      const range = [point.offset - 1, point.offset] as [number, number];
      const deleted_text = original_text.substring(range[0], range[1]);
      const op_remove_text: SlateOperation = {
        type: SlateOperationType.RemoveText,
        text: deleted_text,
        original_text,
        path: point.path,
        offset: range[0],
      };
      _children = SlateNodeOperations.exec(_children, op_remove_text);
      methods.apply([op_remove_text]);
      ui.$selection.methods.moveBackward();
      methods.emitSelectionChange({
        type: SlateOperationType.RemoveText,
      });
    },
    removeContentCrossLines(node1: SlateText, node2: SlateText, start: SlatePoint, end: SlatePoint) {
      const deleted_text1 = node1.text.slice(start.offset);
      // const remaining_text1 = node1.text.slice(0, start.offset);
      const deleted_text2 = node2.text.slice(0, end.offset);
      // const remaining_text2 = node2.text.slice(end.offset);
      // node1.text = remaining_text1 + remaining_text2;
      // _children = SlateSelectionModel.removeLinesBetweenStartAndEnd(_children, start, end);
      //   console.log("[]slate/slate - removeSelectedText - cross lines", _children);
      console.log("[]slate/slate - removeSelectedText - line1 delete text", deleted_text1, start.offset);
      console.log("[]slate/slate - removeSelectedText - line2 delete text", deleted_text2, 0);
      // const ops: SlateOperation[] = [];
      const op_start_delete_text: SlateOperation = {
        type: SlateOperationType.RemoveText,
        text: deleted_text1,
        original_text: node1.text,
        path: start.path,
        offset: start.offset,
      };
      // _children = SlateNodeOperations.removeText(_children, op_start_delete_text);
      // ops.push(op_start_delete_text);
      const op_end_delete_text: SlateOperation = {
        type: SlateOperationType.RemoveText,
        text: deleted_text2,
        original_text: node2.text,
        path: end.path,
        offset: 0,
      };
      // _children = SlateNodeOperations.removeText(_children, op_end_delete_text);
      // ops.push(op_end_delete_text);
      return {
        op_start_delete_text,
        op_end_delete_text,
      };
    },
    /** 跨行操作，删除、回车、输入 时，要不要删除中间的行，删除后 end 坐标应该在哪 */
    removeLinesCrossLines(start: SlatePoint, end: SlatePoint) {
      let _end = end;
      console.log("[]slate/slate - removeSelectedText - need remove lines", end.path, start.path);
      if (end.path[0] - start.path[0] > 1) {
        const op_remove_lines: SlateOperation = {
          type: SlateOperationType.RemoveLines,
          node: _children.slice(start.path[0] + 1, end.path[0]) as (SlateDescendant & { key: number })[],
          path: [start.path[0] + 1, 0],
        };
        _end = {
          path: [end.path[0] - op_remove_lines.node.length, 0],
          offset: end.offset,
        };
        // _children = SlateNodeOperations.removeLines(_children, op3);
        // ops.push(op3);
        return {
          end: _end,
          op_remove_lines: op_remove_lines,
        };
      }
      return null;
    },
    /** 选中的文本后删除，可能是跨节点 */
    removeSelectedTextsCrossNodes(node: SlateText, arr: { start: SlatePoint; end: SlatePoint }) {
      const { start, end } = arr;
      const node1 = methods.findNodeByPath(start.path);
      const node2 = methods.findNodeByPath(end.path);
      //       console.log("[]deleteBackward - is same node", node1 === node2);
      if (node1 && node2 && node1 !== node2) {
        // 跨节点删除
        if (node1.type === SlateDescendantType.Text && node2.type === SlateDescendantType.Text) {
          if (
            SlateSelectionModel.isCaretAtLineHead(_children, start) &&
            SlateSelectionModel.isCaretAtLineEnd(_children, end)
          ) {
            const ops: SlateOperation[] = [];
            const op_remove_lines: SlateOperation = {
              type: SlateOperationType.RemoveLines,
              path: start.path,
              node: [...(_children as (SlateDescendant & { key: number })[])],
            };
            ops.push(op_remove_lines);
            _children = SlateNodeOperations.exec(_children, op_remove_lines);
            const op_insert_lines: SlateOperation = {
              type: SlateOperationType.InsertLines,
              path: start.path,
              node: [
                {
                  key: uid(),
                  type: SlateDescendantType.Paragraph,
                  children: [{ type: SlateDescendantType.Text, text: "" }],
                },
              ],
            };
            ops.push(op_insert_lines);
            _children = SlateNodeOperations.exec(_children, op_insert_lines);
            // 全选删除
            methods.apply(ops);
            ui.$selection.methods.setToHead();
            methods.emitSelectionChange({
              type: SlateOperationType.RemoveLines,
            });
            return;
          }
          // 跨节点删除
          const ops: SlateOperation[] = [];
          const { op_start_delete_text, op_end_delete_text } = methods.removeContentCrossLines(
            node1,
            node2,
            start,
            end
          );
          _children = SlateNodeOperations.exec(_children, op_start_delete_text);
          _children = SlateNodeOperations.exec(_children, op_end_delete_text);
          ops.push(op_start_delete_text);
          ops.push(op_end_delete_text);
          const remove_line_maybe = methods.removeLinesCrossLines(start, end);
          if (remove_line_maybe) {
            _children = SlateNodeOperations.exec(_children, remove_line_maybe.op_remove_lines);
            ops.push(remove_line_maybe.op_remove_lines);
          }
          const op_merge_node: SlateOperation = {
            type: SlateOperationType.MergeNode,
            path: start.path,
            offset: start.offset,
            start: start,
            end: remove_line_maybe ? remove_line_maybe.end : end,
          };
          ops.push(op_merge_node);
          _children = SlateNodeOperations.exec(_children, op_merge_node);
          methods.apply(ops);
          // console.log("[]slate/slate - deleteBackward - selection point", target_point_after_merge);
          ui.$selection.methods.setStartAndEnd({ start: start, end: start });
          methods.emitSelectionChange({
            type: SlateOperationType.MergeNode,
          });
          return;
        }
        console.log("[]slate/slate - removeSelectedTexts - merge node", _children[start.path[0] - 1]);
        const op_merge_node: SlateOperation = {
          type: SlateOperationType.MergeNode,
          path: start.path,
          offset: start.offset,
          start,
          end,
          // point1: { path: start.path, offset: start.offset },
          // point2: { path: end.path, offset: end.offset },
        };
        _children = SlateNodeOperations.exec(_children, op_merge_node);
        methods.apply([op_merge_node]);
        // console.log("[]slate/slate - deleteBackward - selection point", target_point_after_merge);
        ui.$selection.methods.setStartAndEnd({ start: start, end: start });
        methods.emitSelectionChange({
          type: SlateOperationType.MergeNode,
        });
        return;
      }
      const original_text = node.text;
      const range = [start.offset, end.offset] as [number, number];
      const deleted_text = original_text.substring(range[0], range[1]);
      // node.text = deleteTextAtOffset(original_text, deleted_text, range[0]);
      const op_remove_text: SlateOperation = {
        type: SlateOperationType.RemoveText,
        text: deleted_text,
        original_text,
        path: start.path,
        offset: range[0],
      };
      _children = SlateNodeOperations.exec(_children, op_remove_text);
      methods.apply([op_remove_text]);
      ui.$selection.methods.collapseToHead();
      methods.emitSelectionChange({
        type: SlateOperationType.RemoveText,
      });
    },
    handleBackward(param: Partial<{ unit: "character" }> = {}) {
      let start = ui.$selection.start;
      let end = ui.$selection.end;
      const node = methods.findNodeByPath(start.path) as SlateDescendant | null;
      console.log("[]slate/slate - handleBackward - ", node, start.path);
      if (!node || node.type !== SlateDescendantType.Text) {
        console.log("[ERROR]slate/slate - handleBackward");
        return;
      }
      const original_text = node.text;
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      console.log("[]slate/slate - handleBackward - ", is_same_point, original_text, start.offset, end.offset);
      if (is_same_point) {
        if (SlatePointModel.isAtLineHead(start)) {
          if (SlatePointModel.isAtFirstLineHead(start)) {
            return;
          }
          if (node.text === "") {
            const prev_node = findNodeByPath(_children, [start.path[0] - 1, 0]);
            console.log("[]slate/slate - handleBackward - is removeLines?", prev_node);
            if (prev_node && prev_node.type === SlateDescendantType.Text && prev_node.text === "") {
              methods.removeLines(start);
              return;
            }
          }
          console.log("[]slate/slate - handleBackward - is mergeLines?");
          methods.mergeLines(start);
          return;
        }
        console.log("[]slate/slate - handleBackward - is removeText?");
        methods.removeText(node, start);
      }
      methods.removeSelectedTextsCrossNodes(node, { start, end });
    },
    mapNodeWithKey(key?: string) {
      if (!key) {
        return null;
      }
      return depthFirstSearch(_children, Number(key));
    },
    checkIsSelectAll() {},
    collapse() {},
    /** 移动光标 */
    move(opts: { unit: "line"; edge?: "focus"; reverse?: boolean }) {},
    getCaretPosition() {},
    setCaretPosition(arg: { start: SlatePoint; end: SlatePoint }) {},
    handleBeforeInput(event: BeforeInputEvent) {
      event.preventDefault();
      const text = event.data as string;
      if (
        text &&
        _is_composing &&
        _start_before_composing &&
        _start_node_clone &&
        _start_node_clone.type === SlateDescendantType.Text
      ) {
        // 基本上中文输入都是这里，包括合成完成后，也是先调用这里，再调用 composition end
        // const insert_text = text;
        // const op: SlateOperation = {
        //   type: SlateOperationType.ReplaceText,
        //   text: insert_text,
        //   original_text: _start_node_clone.text,
        //   path: _start_before_composing.path,
        //   offset: _start_before_composing.offset,
        // };
        // console.log("[DOMAIN]slate/slate - handleBeforeInput is composing", text, _start_node_clone.text);
        // console.log("[DOMAIN]slate/slate - handleBeforeInput is composing", ui.$selection.print());
        // methods.apply([op]);
        // _children = SlateNodeOperations.replaceText(_children, op);
        // methods.refresh();
        // const vv = {
        //   path: _start_before_composing.path,
        //   offset: _start_before_composing.offset,
        // };
        // console.log("[DOMAIN]slate/slate - handleBeforeInput cursor location", vv);
        // ui.$selection.methods.setStartAndEnd({
        //   start: vv,
        //   end: vv,
        // });
        // methods.emitSelectionChange({ type: SlateOperationType.ReplaceText });
        return;
      }
      if (text === null) {
        return;
      }
      console.log("[DOMAIN]slate/slate ------------------");
      console.log("[DOMAIN]slate/slate - handleBeforeInput", text);
      methods.insertText(text);
    },
    handleInput(event: InputEvent) {
      event.preventDefault();
      // console.log('[]input', event.data);
    },
    handleBlur(event: BlurEvent) {},
    handleFocus(event: FocusEvent) {},
    handleClick() {},
    handleCompositionEnd(event: CompositionEndEvent) {
      event.preventDefault();
      const text = event.data as string;
      console.log("[]handleCompositionEnd", text);
      // 如果合成过程删除，会触发 end 事件
      _is_composing = false;
      if (text === "") {
        _is_cancel_composing = true;
        return;
      }
      // const node = findNodeByPath(_children, ui.$selection.start.path);
      // if (node && node.type === SlateDescendantType.Text) {
      //   const op: SlateOperation = {
      //     type: SlateOperationType.InsertText,
      //     text,
      //     original_text: node.text,
      //     path: ui.$selection.start.path,
      //     offset: ui.$selection.start.offset,
      //   };
      //   _children = SlateNodeOperations.insertText(_children, op);
      //   methods.apply([op]);
      // }
      methods.insertText(text);
    },
    handleCompositionUpdate(event: CompositionUpdateEvent) {
      event.preventDefault();
      if (_is_composing) {
        return;
      }
      _is_composing = true;
    },
    handleCompositionStart(event: CompositionStartEvent) {
      event.preventDefault();
      _is_composing = true;
      const node = findNodeByPath(_children, ui.$selection.start.path);
      if (node) {
        _start_node_clone = { ...node };
      }
      _start_before_composing = { ...ui.$selection.start };
      _end_before_composing = { ...ui.$selection.end };
      console.log("[BIZ]slate/slate - handleCompositionStart");
      const is_same_point = SlatePointModel.isSamePoint(ui.$selection.start, ui.$selection.end);
      if (!is_same_point) {
        // 在合成开始时，发现跨行选择文字，就提前处理好浏览器默认合并的行为，在 end 阶段就不会出问题了
        const node1 = findNodeByPath(_children, ui.$selection.start.path);
        const node2 = findNodeByPath(_children, ui.$selection.end.path);
        if (
          node1 &&
          node2 &&
          node1 !== node2 &&
          node1.type === SlateDescendantType.Text &&
          node2.type === SlateDescendantType.Text
        ) {
          const original_text1 = node1.text;
          const original_text2 = node2.text;
          const deleted_text1 = original_text1.slice(ui.$selection.start.offset);
          const deleted_text2 = original_text2.slice(0, ui.$selection.end.offset);
          const ops: SlateOperation[] = [];
          console.log("[]handleCompositionStart nodes text", node1.text, node2.text);
          const op_delete_text1: SlateOperation = {
            type: SlateOperationType.RemoveText,
            text: deleted_text1,
            original_text: original_text1,
            path: ui.$selection.start.path,
            offset: ui.$selection.start.offset,
          };
          // console.log("[]handleCompositionStart op1", op_delete_text1);
          ops.push(op_delete_text1);
          _children = SlateNodeOperations.exec(_children, op_delete_text1);
          const op_delete_text2: SlateOperation = {
            type: SlateOperationType.RemoveText,
            text: deleted_text2,
            original_text: original_text2,
            path: ui.$selection.end.path,
            offset: 0,
          };
          // console.log("[]handleCompositionStart op2", op_delete_text2);
          ops.push(op_delete_text2);
          _children = SlateNodeOperations.exec(_children, op_delete_text2);
          const r = methods.removeLinesCrossLines(ui.$selection.start, ui.$selection.end);
          if (r) {
            ops.push(r.op_remove_lines);
          }
          const op_merge_node: SlateOperation = {
            type: SlateOperationType.MergeNode,
            path: ui.$selection.start.path,
            offset: ui.$selection.start.offset,
            start: ui.$selection.end,
            end: r ? r.end : ui.$selection.end,
            compositing: true,
          };
          ops.push(op_merge_node);
          _children = SlateNodeOperations.exec(_children, op_merge_node);
          const node = findNodeByPath(_children, ui.$selection.start.path);
          if (node) {
            _start_node_clone = { ...node };
          }
          methods.apply(ops);
          ui.$selection.methods.collapseToOffset({ offset: _start_before_composing.offset });
          methods.emitSelectionChange({ type: SlateOperationType.Unknown });
        }
      }
    },
    handleKeyDown(event: KeyDownEvent) {
      // console.log('key down', event.code);
      // event.preventDefault();
      ui.$shortcut.methods.handleKeydown(event);
    },
    handleKeyUp(event: KeyDownEvent) {
      // event.preventDefault();
      ui.$shortcut.methods.handleKeyup(event);
    },
    handleSelectionChange() {
      //       console.log("handleSelectionChange", ui.$selection.dirty);
      if (ui.$selection.dirty) {
        return;
      }
      methods.getCaretPosition();
    },
  };
  const ui = {
    $selection: SlateSelectionModel(),
    $history: SlateHistoryModel(),
    $shortcut: ShortcutModel(),
  };

  let _children = addKeysToSlateNodes(props.defaultValue ?? []);
  /** 是否处于 输入合成 中 */
  let _is_composing = false;
  let _is_cancel_composing = false;
  let _start_node_clone: SlateDescendant | null = null;
  let _start_before_composing: SlatePoint | null = null;
  let _end_before_composing: SlatePoint | null = null;
  let _is_updating_selection = false;
  let _is_focus = false;
  //   let _children: Descendant[] = [];
  //   let _decorations: DecoratedRange[] = [];
  //   let _node: Ancestor;
  let _state = {
    get children() {
      return _children;
    },
    get isFocus() {
      return _is_focus;
    },
    get JSON() {
      return JSON.stringify(_children, null, 2);
    },
  };
  enum Events {
    Action,
    SelectionChange,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Action]: SlateOperation[];
    [Events.SelectionChange]: { type?: SlateOperationType; start: SlatePoint; end: SlatePoint };
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$shortcut.methods.register({
    // ArrowRight(event) {
    //   const node = methods.findNodeByPath(ui.$selection.start.path);
    //   if (!node) {
    //     return;
    //   }
    //   if (node.type === SlateDescendantType.Text && node.text === "") {
    //     event.preventDefault();
    //     ui.$selection.methods.moveToNextLineHead();
    //     bus.emit(Events.SelectionChange, {
    //       type: SlateOperationType.Unknown,
    //       start: ui.$selection.start,
    //       end: ui.$selection.start,
    //     });
    //   }
    // },
    // ArrowLeft(event) {
    //   //       console.log("[]ArrowLeft", [ui.$selection.start.path[0] - 1, 0]);
    //   if (ui.$selection.start.offset !== 0) {
    //     return;
    //   }
    //   const path = ui.$selection.start.path;
    //   path[0] = path[0] - 1;
    //   const node = methods.findNodeByPath(path);
    //   if (!node) {
    //     return;
    //   }
    //   console.log("[]ArrowLeft", node);
    //   if (node.type === SlateDescendantType.Text && node.text === "") {
    //     event.preventDefault();
    //     // ui.$selection.methods.moveToPrevLineHead();
    //     console.log("[]ArrowLeft", ui.$selection.start);
    //     bus.emit(Events.SelectionChange, {
    //       type: SlateOperationType.Unknown,
    //       start: ui.$selection.start,
    //       end: ui.$selection.start,
    //     });
    //   }
    // },
    "MetaLeft+KeyZ"() {
      console.log("[]MetaLeft+KeyZ");
      const { operations, selection } = ui.$history.methods.undo();
      for (let i = 0; i < operations.length; i += 1) {
        const op = operations[i];
        console.log("[]Undo op", i, op.type);
        _children = SlateNodeOperations.exec(_children, op);
      }
      bus.emit(Events.Action, operations);
      if (selection) {
        bus.emit(Events.SelectionChange, { ...selection, type: SlateOperationType.Unknown });
      }
    },
    async "MetaLeft+KeyV"(event) {
      event.preventDefault();
      console.log("[]slate/slate - MetaLeft+KeyV");
      const r = await props.app.$clipboard.readText();
      if (r.error) {
        console.log("", r.error.message);
        return;
      }
      const text = r.data;
      console.log(text);
    },
    Enter(event) {
      if (_is_composing) {
        return;
      }
      event.preventDefault();
      if (SlatePointModel.isAtLineHead(ui.$selection.start)) {
        methods.insertLineBefore();
        return;
      }
      const isCaretAtLineEnd = SlateSelectionModel.isCaretAtLineEnd(_children, ui.$selection.start);
      console.log("[]slate/slate - Enter", isCaretAtLineEnd);
      if (isCaretAtLineEnd) {
        methods.insertLineAfter();
        return;
      }
      methods.splitLine();
    },
    Backspace(event) {
      // console.log("[BIZ]slate/slate - Backspace -", _is_composing, _is_cancel_composing);
      if (_is_cancel_composing || _is_composing) {
        _is_cancel_composing = false;
        return;
      }
      event.preventDefault();
      methods.handleBackward();
    },
  });

  return {
    methods,
    ui,
    state: _state,
    get isFocus() {
      return _state.isFocus;
    },
    ready() {},
    destroy() {
      bus.destroy();
    },
    onAction(handler: Handler<TheTypesOfEvents[Events.Action]>) {
      return bus.on(Events.Action, handler);
    },
    onSelectionChange(handler: Handler<TheTypesOfEvents[Events.SelectionChange]>) {
      return bus.on(Events.SelectionChange, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}

export type SlateEditorModel = ReturnType<typeof SlateEditorModel>;

const uid = uidFactory();
function addKeysToSlateNodes(nodes: SlateDescendant[]): SlateDescendant[] {
  return nodes.map((node) => {
    const key = uid();
    if (node.type === SlateDescendantType.Text) {
      return {
        ...node,
        key,
      };
    }
    if (node.type === SlateDescendantType.Paragraph) {
      return {
        ...node,
        key,
        children: addKeysToSlateNodes(node.children),
      };
    }
    // @ts-ignore
    return { ...node, key };
  });
}
