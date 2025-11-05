import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { ShortcutModel } from "@/biz/shortcut/shortcut";

import { SlatePoint, SlatePointModel } from "./point";
import { SlateSelectionModel } from "./selection";
import { isObject } from "./utils/is-object";
import {
  SlateText,
  SlateParagraph,
  SlateDescendant,
  SlateNode,
  SlateOperation,
  SlateDescendantType,
  SlateOperationType,
} from "./types";
import { uidFactory } from "@/utils";

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
    apply(operation: SlateOperation) {
      bus.emit(Events.Action, operation);
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
    _insertText(text: string, options: TextInsertTextOptions = {}) {
      const path = ui.$selection.start.path;
      const node = methods.findNodeByPath(path) as SlateDescendant | null;
      console.log("[]_insertText", text, path, node);
      if (!node || node.type !== SlateDescendantType.Text) {
        return;
      }
      const isEmptyTextNode = node.text === "";
      if (_start_before_composing && _end_before_composing) {
        ui.$selection.methods.setStartAndEnd({ start: _start_before_composing, end: _end_before_composing });
        _start_before_composing = null;
        _end_before_composing = null;
      }
      const offset = ui.$selection.start.offset;
      node.text = node.text.substring(0, offset) + text + node.text.substring(offset);
      // ui.$selection.methods.moveForward({ step: isEmptyTextNode ? text.length - 1 : text.length });
      ui.$selection.methods.moveForward({ step: text.length });
      methods.apply({ type: SlateOperationType.InsertText, wholeText: node.text, node, path, offset });
    },
    insertText(text: string, options: TextInsertTextOptions = {}) {
      //       const { selection, marks } = editor;
      const selection = ui.$selection;
      //       const marks = _marks;
      if (selection) {
        // if (marks) {
        //   const node = { text, ...marks };
        //   Transforms.insertNodes(node, {
        //     at: options.at,
        //     voids: options.voids,
        //   });
        // } else {
        //   Transforms.insertText(text, options);
        methods._insertText(text, options);
        // }
        // _marks = null;
      }
    },
    isCaretAtLineEnd() {
      if (!ui.$selection.collapsed) {
        return false;
      }
      const { start } = ui.$selection;
      console.log("[]slate/slate - isCaretAtLineEnd", start.path, start.offset);
      let i = 0;
      let n = _children[start.path[i]];
      while (i < start.path.length - 1) {
        i += 1;
        const idx = start.path[i];
        if (n.type === SlateDescendantType.Paragraph) {
          // console.log("[]slate/slate - isCaretAtLineEnd", i, idx, n.children);
          if (idx !== n.children.length - 1) {
            return false;
          }
          n = n.children[idx];
        }
      }
      if (n.type === SlateDescendantType.Text) {
        // hack 零宽度字符的情况
        if (n.text === "") {
          return true;
        }
        if (start.offset === n.text.length) {
          return true;
        }
      }
      return false;
    },
    insertLine() {
      const isCaretAtLineEnd = methods.isCaretAtLineEnd();
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
        methods.apply({
          type: SlateOperationType.InsertLine,
          idx: line_idx,
          node: created_node,
        });
      }
    },
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
      const isSamePoint = SlatePointModel.isSamePoint(start, end);
      console.log("[]deleteBackward - before node.text.substring", node.text, isSamePoint, start.offset, end.offset);
      if (isSamePoint) {
        node.text = node.text.substring(0, start.offset - 1) + node.text.substring(end.offset);
        // ui.$selection.methods.moveBackward({ min: node.text === "" ? 1 : 0 });
        ui.$selection.methods.moveBackward();
      } else {
        node.text = node.text.substring(0, start.offset) + node.text.substring(end.offset);
        ui.$selection.methods.collapseToHead();
      }
      start = ui.$selection.start;
      end = ui.$selection.end;
      console.log("[]deleteBackward - after node.text.substring", node.text, node);
      methods.apply({
        type: SlateOperationType.DeleteText,
        wholeText: node.text,
        node,
        path: start.path,
        offset: start.offset,
      });
    },
    mapNodeWithKey(key?: string) {
      if (!key) {
        return null;
      }
      return depthFirstSearch(_children, Number(key));
    },
    /** Hotkey 实现根据 event 判断是否匹配命令 */
    isMoveLineBackward(event: KeyDownEvent) {},
    isMoveLineForward(event: KeyDownEvent) {},
    isExtendLineBackward(event: KeyDownEvent) {},
    isExtendLineForward(event: KeyDownEvent) {},
    isMoveBackward(event: KeyDownEvent) {},
    isMoveForward(event: KeyDownEvent) {},
    isMoveWordBackward(event: KeyDownEvent) {},
    isMoveWordForward(event: KeyDownEvent) {},
    isBold(event: KeyDownEvent) {},
    isItalic(event: KeyDownEvent) {},
    isSplitBlock(event: KeyDownEvent) {},
    isDeleteBackward(event: KeyDownEvent) {},
    isDeleteForward(event: KeyDownEvent) {},
    isDeleteLineBackward(event: KeyDownEvent) {},
    isDeleteLineForward(event: KeyDownEvent) {},
    isDeleteWordBackward(event: KeyDownEvent) {},
    isDeleteWordForward(event: KeyDownEvent) {},
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
      console.log("[BIZ]slate/slate - handleCompositionStart");
      _is_composing = true;
      _start_before_composing = ui.$selection.start;
      _end_before_composing = ui.$selection.end;
    },
    handleKeyDown(event: KeyDownEvent) {
      //       if (_is_composing && !event.nativeEvent.isComposing) {
      //         _is_composing = false;
      //       }
      //       if (_is_composing) {
      //         return;
      //       }
      //       //       console.log("[]handleKeyDown - code", event.code);
      //       if (event.code === "Backspace") {
      //         event.preventDefault();
      //         methods.deleteBackward();
      //         return;
      //       }
      //       // 判断是否移动光标
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
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Action]: SlateOperation;
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$shortcut.methods.register({
    "ArrowUp,ArrowDown,ArrowLeft,ArrowRight"() {
      setTimeout(() => {
        methods.getCaretPosition();
      }, 0);
    },
    "MetaLeft+KeyA"() {
      console.log("[]MetaLeft+KeyA");
      setTimeout(() => {
        methods.getCaretPosition();
      }, 0);
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

/**
 * 深度优先搜索 - 适合查找深层节点
 */
function depthFirstSearch(nodes: (SlateDescendant & { key?: number })[], targetKey: number): SlateDescendant | null {
  for (const node of nodes) {
    // 检查当前节点
    if (node.key === targetKey) {
      return node;
    }

    // 如果是段落节点，递归搜索子节点
    if (node.type === SlateDescendantType.Paragraph && node.children) {
      const found = depthFirstSearch(node.children, targetKey);
      if (found) {
        return found;
      }
    }
  }

  return null;
}
