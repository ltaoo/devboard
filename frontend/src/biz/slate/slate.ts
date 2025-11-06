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
import { deleteTextInRange, insertTextAtOffset } from "./utils/text";
import { depthFirstSearch } from "./utils/node";

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

export function SlateEditorModel(props: { defaultValue?: SlateDescendant[] }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    apply(operations: SlateOperation[]) {
      ui.$history.methods.push(operations, { start: ui.$selection.start, end: ui.$selection.end });
      bus.emit(Events.Action, operations);
    },
    isText(value: any): value is SlateText {
      return isObject(value) && typeof value.text === "string";
    },
    isElement(value: any, extra: Partial<{ deep: boolean }> = {}): value is SlateParagraph {
      const { deep = false } = extra;
      if (!isObject(value)) {
        return false;
      }
      // PERF: No need to use the full Editor.isEditor here
      const isEditor = typeof value.apply === "function";
      if (isEditor) {
        return false;
      }
      const isChildrenValid = deep ? methods.isNodeList(value.children) : Array.isArray(value.children);
      return isChildrenValid;
    },
    isNode(value: any, extra: { deep: boolean }): value is SlateNode {
      return methods.isText(value) || methods.isElement(value, extra);
    },
    isNodeList(value: any) {
      return Array.isArray(value) && value.every((v) => methods.isNode(v, { deep: true }));
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
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      if (is_same_point) {
        start_node.text = insertTextAtOffset(original_text, inserted_text, start.offset);
        methods.apply([
          {
            type: SlateOperationType.InsertText,
            text: inserted_text,
            //     node: start_node,
            path: start.path,
            offset: start.offset,
          },
          //   {
          //     type: SlateOperationType.SetSelection,
          //     start: ui.$selection.start,
          //     end: ui.$selection.start,
          //   },
        ]);
        ui.$selection.methods.moveForward({ step: text.length });
        bus.emit(Events.SelectionChange, {
          start: ui.$selection.start,
          end: ui.$selection.start,
        });
      } else {
        const range = [start.offset, end.offset] as [number, number];
        start_node.text = insertTextAtOffset(deleteTextInRange(original_text, range), inserted_text, range[0]);
        // ui.$selection.methods.moveForward({ step: text.length, collapse: true });
        const deleted_text = original_text.substring(range[0], range[1]);
        fmt.Println("[]insertText - before DeleteText", original_text, range, deleted_text, start_node.text);
        methods.apply([
          {
            type: SlateOperationType.RemoveText,
            // 先选择再输入中文的场景，如 hello 选择 ell，再输入，$target.innerHTML 是 ho，所以不能再删除任何内容了
            text: is_finish_composing ? "" : deleted_text,
            path: start.path,
            offset: start.offset,
          },
          {
            type: SlateOperationType.InsertText,
            text: inserted_text,
            path: start.path,
            offset: start.offset,
          },
          //   {
          //     type: SlateOperationType.SetSelection,
          //     start: ui.$selection.start,
          //     end: ui.$selection.start,
          //   },
        ]);
        ui.$selection.methods.collapseToOffset({ offset: start.offset + inserted_text.length });
        bus.emit(Events.SelectionChange, {
          start: ui.$selection.start,
          end: ui.$selection.start,
        });
        fmt.Println("[]insertText - before InsertText", inserted_text);
      }
    },
    /** 新增行 */
    insertLine() {
      const isCaretAtLineEnd = methods.isCaretAtLineEnd(ui.$selection.start);
      console.log("[]slate/slate - insertLine", isCaretAtLineEnd);
      if (isCaretAtLineEnd) {
        const { start } = ui.$selection;
        const line_idx = start.path[0];
        const created_node = {
          type: SlateDescendantType.Paragraph,
          children: [{ type: SlateDescendantType.Text, text: "" }],
        } as SlateDescendant;
        _children = [..._children.slice(0, line_idx + 1), created_node, ..._children.slice(line_idx + 1)];
        ui.$selection.methods.moveToNextLineHead();
        console.log("[]slate/slate - insertLine _children", _children);
        methods.apply([
          {
            type: SlateOperationType.InsertLine,
            node: created_node,
            path: [line_idx],
          },
          //   {
          //     type: SlateOperationType.SetSelection,
          //     start: ui.$selection.start,
          //     end: ui.$selection.start,
          //   },
        ]);
        bus.emit(Events.SelectionChange, {
          start: ui.$selection.start,
          end: ui.$selection.start,
        });
      }
    },
    /** 删除 */
    deleteBackward(param: Partial<{ unit: "character" }> = {}) {
      let start = ui.$selection.start;
      let end = ui.$selection.end;
      const node = methods.findNodeByPath(start.path) as SlateDescendant | null;
      if (!node || node.type !== SlateDescendantType.Text) {
        return;
      }
      if (node.text === "") {
        return;
      }
      const is_same_point = SlatePointModel.isSamePoint(start, end);
      const original_text = node.text;
      //       console.log("[]deleteBackward - before node.text.substring", isSamePoint, node.text, start.offset, end.offset);
      const { path, text, range } = (() => {
        if (is_same_point) {
          const range = [start.offset - 1, end.offset] as [number, number];
          node.text = deleteTextInRange(original_text, range);
          ui.$selection.methods.moveBackward();
          const deleted_text = original_text.substring(range[0], range[1]);
          //   console.log("[]deleteBackward - before substring", original_text, deleted_text, node.text, range);
          return {
            text: deleted_text,
            path: start.path,
            range,
          };
        } else {
          const range = [start.offset, end.offset] as [number, number];
          node.text = deleteTextInRange(original_text, range);
          ui.$selection.methods.collapseToHead();
          const deleted_text = original_text.substring(range[0], range[1]);
          //   console.log("[]deleteBackward - before substring", original_text, deleted_text, node.text, range);
          return {
            text: deleted_text,
            path: start.path,
            range,
          };
        }
      })();
      start = ui.$selection.start;
      end = ui.$selection.end;
      //       console.log("[]deleteBackward - after node.text.substring", node.text, text, range);
      methods.apply([
        {
          type: SlateOperationType.RemoveText,
          text,
          path,
          offset: range[0],
        },
      ]);
      bus.emit(Events.SelectionChange, {
        start: ui.$selection.start,
        end: ui.$selection.start,
      });
    },
    mapNodeWithKey(key?: string) {
      if (!key) {
        return null;
      }
      return depthFirstSearch(_children, Number(key));
    },
    isCaretAtLineEnd(start: SlatePoint) {
      //       if (!ui.$selection.collapsed) {
      //         return false;
      //       }
      //       const { start } = ui.$selection;
      console.log("[]slate/slate - isCaretAtLineEnd", start.path, start.offset);
      let i = 0;
      let n = _children[start.path[i]];
      while (i < start.path.length - 1) {
        i += 1;
        const idx = start.path[i];
        if (n.type === SlateDescendantType.Paragraph) {
          if (idx !== n.children.length - 1) {
            return false;
          }
          n = n.children[idx];
        }
      }
      if (n.type === SlateDescendantType.Text) {
        if (start.offset === n.text.length) {
          return true;
        }
      }
      return false;
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
      console.log(operations, selection);
      methods.apply(operations);
      if (selection) {
        bus.emit(Events.SelectionChange, selection);
      }
    },
    Enter(event) {
      if (_is_composing) {
        return;
      }
      event.preventDefault();
      methods.insertLine();
    },
    Backspace(event) {
      console.log("[BIZ]slate/slate - Backspace -", _is_composing, _is_cancel_composing);
      if (_is_cancel_composing || _is_composing) {
        _is_cancel_composing = false;
        return;
      }
      event.preventDefault();
      methods.deleteBackward();
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
