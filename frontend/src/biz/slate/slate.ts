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
import { ViewComponentProps } from "@/store/types";

type BeforeInputEvent = {
  preventDefault(): void;
  data: unknown;
};
type BlurEvent = {};
type FocusEvent = {};
type CompositionEndEvent = {
  data: unknown;
};
type CompositionUpdateEvent = {};
type CompositionStartEvent = {};
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
      const selection = ui.$selection;
      if (!selection) {
        return;
      }
      let start = ui.$selection.start;
      let end = ui.$selection.end;
      const start_node = methods.findNodeByPath(start.path) as SlateDescendant | null;
      if (!start_node || start_node.type !== SlateDescendantType.Text) {
        return;
      }
      let is_finish_composing = false;
      if (_start_before_composing && _end_before_composing) {
        ui.$selection.methods.setStartAndEnd({ start: _start_before_composing, end: _end_before_composing });
        is_finish_composing = true;
        _start_before_composing = null;
        _end_before_composing = null;
      }
      start = ui.$selection.start;
      end = ui.$selection.end;
      const original_text = start_node.text;
      const inserted_text = text;
      if ([" ", "，", "。", "；"].includes(inserted_text)) {
        ui.$history.methods.mark();
      }
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      if (is_same_point) {
        start_node.text = insertTextAtOffset(original_text, inserted_text, start.offset);
        methods.apply([
          {
            type: SlateOperationType.InsertText,
            text: inserted_text,
            path: start.path,
            offset: start.offset,
          },
        ]);
        ui.$selection.methods.moveForward({ step: text.length });
        bus.emit(Events.SelectionChange, {
          start: ui.$selection.start,
          end: ui.$selection.start,
        });
        return;
      }
      const range = [start.offset, end.offset] as [number, number];
      // ui.$selection.methods.moveForward({ step: text.length, collapse: true });
      const deleted_text = original_text.substring(range[0], range[1]);
      fmt.Println("[]insertText - before DeleteText", original_text, range, deleted_text, start_node.text);
      // const ops = [];
      start_node.text = insertTextAtOffset(deleteTextInRange(original_text, range), inserted_text, range[0]);
      if (!is_finish_composing) {
        // ops.push({
        //   type: SlateOperationType.RemoveText,
        //   // 先选择再输入中文的场景，如 hello 选择 ell，再输入，$target.innerHTML 是 ho，所以不能再删除任何内容了
        //   text: is_finish_composing ? "" : deleted_text,
        //   path: start.path,
        //   offset: start.offset,
        // } as SlateOperation);
      }
      // ops.push({
      //   type: SlateOperationType.InsertText,
      //   text: inserted_text,
      //   path: start.path,
      //   offset: start.offset,
      // } as SlateOperation);
      methods.apply([
        {
          type: SlateOperationType.RemoveText,
          // 先选择再输入中文的场景，如 hello 选择 ell，再输入，$target.innerHTML 是 ho，所以不能再删除任何内容了
          ignore: true,
          text: deleted_text,
          path: start.path,
          offset: start.offset,
        },
        {
          type: SlateOperationType.InsertText,
          text: inserted_text,
          path: start.path,
          offset: start.offset,
        },
      ]);
      ui.$selection.methods.collapseToOffset({ offset: start.offset + inserted_text.length });
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
      });
      // fmt.Println("[]insertText - before InsertText", inserted_text);
    },
    /** 前面新增行 */
    insertLineBefore() {
      const { start } = ui.$selection;
      const line_idx = start.path[0];
      const created_node = {
        type: SlateDescendantType.Paragraph,
        children: [{ type: SlateDescendantType.Text, text: "" }],
      } as SlateDescendant;
      _children = [..._children.slice(0, line_idx), created_node, ..._children.slice(line_idx)];
      console.log("[]slate/slate - insertLineBefore _children", _children);
      methods.apply([
        {
          type: SlateOperationType.InsertLines,
          node: [created_node],
          path: [line_idx - 1],
        },
      ]);
      ui.$selection.methods.moveToNextLineHead();
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
      });
    },
    /** 后面新增行 */
    insertLineAfter() {
      const { start } = ui.$selection;
      const line_idx = start.path[0];
      const created_node = {
        type: SlateDescendantType.Paragraph,
        children: [{ type: SlateDescendantType.Text, text: "" }],
      } as SlateDescendant;
      _children = [..._children.slice(0, line_idx + 1), created_node, ..._children.slice(line_idx + 1)];
      console.log("[]slate/slate - insertLineAfter _children", _children);
      methods.apply([
        {
          type: SlateOperationType.InsertLines,
          node: [created_node],
          path: [line_idx],
        },
      ]);
      ui.$selection.methods.moveToNextLineHead();
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
      });
    },
    /** 拆分当前行 */
    splitLine() {
      const { start, end } = ui.$selection;
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      if (is_same_point) {
        const node = methods.findNodeByPath(start.path);
        if (!node || node.type !== SlateDescendantType.Text) {
          return;
        }
        const original_text = node.text;
        const text1 = original_text.slice(0, start.offset);
        const text2 = original_text.slice(start.offset);
        node.text = text1;
        const created_node = {
          type: SlateDescendantType.Paragraph,
          children: [
            {
              type: SlateDescendantType.Text,
              text: text2,
            },
          ],
        } as SlateDescendant;
        _children = [..._children.slice(0, start.path[0] + 1), created_node, ..._children.slice(start.path[0] + 1)];
        console.log("[]slate/slate - splitLine", _children);
        methods.apply([
          {
            type: SlateOperationType.SplitNode,
            path: start.path,
            offset: start.offset,
            node: created_node,
          },
        ]);
        ui.$selection.methods.moveToNextLineHead();
        bus.emit(Events.SelectionChange, {
          start: ui.$selection.start,
          end: ui.$selection.start,
        });
        return;
      }
      // 选择部分内容后，输入回车进行拆分行
      const node1 = methods.findNodeByPath(start.path);
      const node2 = methods.findNodeByPath(end.path);
      if (!node1 || node1.type !== SlateDescendantType.Text || !node2 || node2.type !== SlateDescendantType.Text) {
        return;
      }
      const original_text = node1.text;
      const text1 = original_text.slice(0, start.offset);
      const text2 = original_text.slice(end.offset);
      node1.text = text1;
      const created_node = {
        type: SlateDescendantType.Paragraph,
        children: [
          {
            type: SlateDescendantType.Text,
            text: text2,
          },
        ],
      } as SlateDescendant;
      _children = [..._children.slice(0, start.path[0] + 1), created_node, ..._children.slice(start.path[0] + 1)];
      methods.apply([
        {
          type: SlateOperationType.SplitNode,
          path: start.path,
          offset: start.offset,
          node: created_node,
        },
      ]);
      ui.$selection.methods.moveToNextLineHead();
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
      });
    },
    mergeLines(start: SlatePoint) {
      // 需要合并两行
      //   const prev_line = methods.findNodeByPath([start.path[0] - 1]);
      //   const cur_line = methods.findNodeByPath(start.path);
      const prev_line_last_node = SlateSelectionModel.getLineLastNode(_children, start.path[0] - 1);
      const cur_line_last_node = SlateSelectionModel.getLineFirstNode(_children, start.path[0]);
      const target_point_after_merge = SlateSelectionModel.getLineLastPoint(_children, start.path[0] - 1);
      //   console.log("[]prev line end point", start.path[0] - 1, point);
      if (
        prev_line_last_node.node.type === SlateDescendantType.Text &&
        cur_line_last_node.node.type === SlateDescendantType.Text
      ) {
        prev_line_last_node.node.text = prev_line_last_node.node.text + cur_line_last_node.node.text;
        _children = SlateSelectionModel.removeLine(_children, start.path[0]);
      }
      console.log("[]slate/slate - deleteBackward - merge node", _children[start.path[0] - 1]);
      methods.apply([
        {
          type: SlateOperationType.MergeNode,
          point1: { path: prev_line_last_node.path, offset: prev_line_last_node.offset },
          point2: { path: cur_line_last_node.path, offset: cur_line_last_node.offset },
        },
      ]);
      console.log("[]slate/slate - deleteBackward - selection point", target_point_after_merge);
      ui.$selection.methods.setStartAndEnd({ start: target_point_after_merge, end: target_point_after_merge });
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
      });
    },
    /** 删除指定位置的文本 */
    removeText(node: SlateText, point: SlatePoint) {
      const original_text = node.text;
      const range = [point.offset - 1, point.offset] as [number, number];
      const deleted_text = original_text.substring(range[0], range[1]);
      //   console.log("[]deleteBackward - before substring", original_text, deleted_text, node.text, range);
      node.text = deleteTextAtOffset(original_text, deleted_text, range[0]);
      methods.apply([
        {
          type: SlateOperationType.RemoveText,
          text: deleted_text,
          path: point.path,
          offset: range[0],
        },
      ]);
      ui.$selection.methods.moveBackward();
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
      });
    },
    /** 删除选中的文本 */
    removeSelectedTexts(node: SlateText, arr: { start: SlatePoint; end: SlatePoint }) {
      const { start, end } = arr;
      const node1 = methods.findNodeByPath(start.path);
      const node2 = methods.findNodeByPath(end.path);
      //       console.log("[]deleteBackward - is same node", node1 === node2);
      if (node1 && node2 && node1 !== node2) {
        // 跨节点删除
        if (node1.type === SlateDescendantType.Text && node2.type === SlateDescendantType.Text) {
          const deleted_text1 = node1.text.slice(start.offset);
          const remaining_text1 = node1.text.slice(0, start.offset);
          const deleted_text2 = node2.text.slice(0, end.offset);
          const remaining_text2 = node2.text.slice(end.offset);
          node1.text = remaining_text1 + remaining_text2;
          _children = SlateSelectionModel.removeLinesBetweenStartAndEnd(_children, start, end);
          //   console.log("[]slate/slate - removeSelectedText - cross lines", _children);
          console.log("[]slate/slate - removeSelectedText - line1 delete text", deleted_text1, start.offset);
          console.log("[]slate/slate - removeSelectedText - line2 delete text", deleted_text2, 0);
          methods.apply([
            {
              type: SlateOperationType.RemoveText,
              text: deleted_text1,
              path: start.path,
              offset: start.offset,
            },
            {
              type: SlateOperationType.RemoveText,
              text: deleted_text2,
              path: end.path,
              offset: 0,
            },
            {
              type: SlateOperationType.RemoveLines,
              node: _children.slice(start.path[0] + 1, end.path[0] + 1),
              path: end.path,
            },
            {
              type: SlateOperationType.MergeNode,
              point1: { path: start.path, offset: start.offset },
              point2: { path: end.path, offset: end.offset },
            },
          ]);
          // console.log("[]slate/slate - deleteBackward - selection point", target_point_after_merge);
          ui.$selection.methods.setStartAndEnd({ start: start, end: start });
          bus.emit(Events.SelectionChange, {
            start: ui.$selection.start,
            end: ui.$selection.start,
          });
          return;
        }
        console.log("[]slate/slate - removeSelectedTexts - merge node", _children[start.path[0] - 1]);
        _children = SlateSelectionModel.removeLine(_children, start.path[0]);
        methods.apply([
          {
            type: SlateOperationType.MergeNode,
            point1: { path: start.path, offset: start.offset },
            point2: { path: end.path, offset: end.offset },
          },
        ]);
        // console.log("[]slate/slate - deleteBackward - selection point", target_point_after_merge);
        ui.$selection.methods.setStartAndEnd({ start: start, end: start });
        bus.emit(Events.SelectionChange, {
          start: ui.$selection.start,
          end: ui.$selection.start,
        });
        return;
      }
      const original_text = node.text;
      const range = [start.offset, end.offset] as [number, number];
      const deleted_text = original_text.substring(range[0], range[1]);
      node.text = deleteTextAtOffset(original_text, deleted_text, range[0]);
      methods.apply([
        {
          type: SlateOperationType.RemoveText,
          text: deleted_text,
          path: start.path,
          offset: range[0],
        },
      ]);
      ui.$selection.methods.collapseToHead();
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
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
          methods.mergeLines(start);
          return;
        }
        methods.removeText(node, start);
        return;
      }
      methods.removeSelectedTexts(node, { start, end });
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
      if (_is_composing) {
        return;
      }
      const text = event.data as string;
      if (text === null) {
        return;
      }
      console.log("[DOMAIN]slate/slate - handleBeforeInput", text);
      methods.insertText(text);
    },
    handleInput(event: InputEvent) {},
    handleBlur(event: BlurEvent) {},
    handleFocus(event: FocusEvent) {},
    handleClick() {},
    handleCompositionEnd(event: CompositionEndEvent) {
      const text = event.data as string;
      // 如果合成过程删除，会触发 end 事件
      _is_composing = false;
      if (text === "") {
        _is_cancel_composing = true;
        return;
      }
      console.log("[]handleCompositionEnd", text);
      methods.insertText(text);
    },
    handleCompositionUpdate(event: CompositionUpdateEvent) {
      if (_is_composing) {
        return;
      }
      _is_composing = true;
    },
    handleCompositionStart(event: CompositionStartEvent) {
      _is_composing = true;
      _start_before_composing = { ...ui.$selection.start };
      _end_before_composing = { ...ui.$selection.end };
      console.log(
        "[BIZ]slate/slate - handleCompositionStart",
        _start_before_composing.offset,
        _end_before_composing.offset
      );
    },
    handleKeyDown(event: KeyDownEvent) {
      ui.$shortcut.methods.handleKeydown(event);
    },
    handleKeyUp(event: KeyDownEvent) {
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
  let _start_before_composing: SlatePoint | null = null;
  let _end_before_composing: SlatePoint | null = null;
  let _is_updating_selection = false;
  let _is_focus = true;
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
    [Events.SelectionChange]: { start: SlatePoint; end: SlatePoint };
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$shortcut.methods.register({
    "MetaLeft+KeyZ"() {
      console.log("[]MetaLeft+KeyZ");
      const { operations, selection } = ui.$history.methods.undo();
      // console.log(operations, selection);
      for (let i = 0; i < operations.length; i += 1) {
        const op = operations[i];
        if (op.type === SlateOperationType.InsertText) {
          const node = methods.findNodeByPath(op.path);
          if (node && node.type === SlateDescendantType.Text) {
            node.text = insertTextAtOffset(node.text, op.text, op.offset);
          }
        }
        if (op.type === SlateOperationType.RemoveText) {
          const node = methods.findNodeByPath(op.path);
          if (node && node.type === SlateDescendantType.Text) {
            node.text = deleteTextAtOffset(node.text, op.text, op.offset);
          }
        }
      }
      bus.emit(Events.Action, operations);
      if (selection) {
        bus.emit(Events.SelectionChange, selection);
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
