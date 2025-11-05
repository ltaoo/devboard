import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { ShortcutModel } from "@/biz/shortcut/shortcut";

import { SlatePathModel } from "./path";
import { SlateTextNodeModel } from "./text";
import { isObject } from "./utils/is-object";
import { SlatePoint, SlatePointModel } from "./point";

// import { DecoratedRange } from "./types";

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

function SlateSelectionModel() {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    /** 光标向前移动n步 */
    moveForward(param: Partial<{ step: number }> = {}) {
      const { step = 1 } = param;
      _start.offset += step;
      _end.offset += step;
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    /** 光标向后移动n步 */
    moveBackward(param: Partial<{ step: number }> = {}) {
      const { step = 1 } = param;
      _start.offset -= step;
      _end.offset -= step;
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    /** 从选区变成位于起点的光标 */
    collapseToStart() {
      _end = { ..._start };
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    /** 从选区变成位于终点光标 */
    collapseToEnd() {
      _start = { ..._end };
      methods.setStartAndEnd({ start: _start, end: _end });
    },
    setStartAndEnd(param: { start: SlatePoint; end: SlatePoint }) {
      _start = param.start;
      _end = param.end;
      _is_collapsed = SlatePointModel.isSamePoint(param.start, param.end);
      _dirty = true;
      setTimeout(() => {
        _dirty = false;
      }, 0);
      methods.refresh();
    },
    handleChange(event: { start: SlatePoint; end: SlatePoint; collapsed: boolean }) {
      _start = event.start;
      _end = event.end;
      _is_collapsed = event.collapsed;
      methods.refresh();
    },
  };

  let _start: SlatePoint = { path: [], offset: 0 };
  let _end: SlatePoint = { path: [], offset: 0 };
  let _is_collapsed = true;
  let _dirty = false;
  const ui = {};

  let _state = {
    get start() {
      return _start;
    },
    get end() {
      return _end;
    },
    get collapsed() {
      return _is_collapsed;
    },
  };
  enum Events {
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  return {
    methods,
    ui,
    state: _state,
    get dirty() {
      return _dirty;
    },
    ready() {},
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}
type SlateSelectionModel = ReturnType<typeof SlateSelectionModel>;

type SlateOperation = {
  /** 操作类型 */
  type: "insert_text" | "delete_text";
  /** 操作的文本*/
  text: string;
  /** 操作后的文本 */
  wholeText: string;
  node: SlateDescendant;
  /** 操作位置 */
  offset: number;
  /** 操作节点路径 */
  path: number[];
};

type SlateNode = {};
type SlateElement = { type: string; children: SlateDescendant[] };
type SlateText = { text: string };
export type SlateDescendant = SlateText | SlateElement;

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
    isElement(value: any, extra: Partial<{ deep: boolean }> = {}): value is SlateElement {
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
      //       let at = methods.getDefaultInsertLocation();
      //       if (SlatePathModel.isPath(at)) {
      //         at = methods.range(at);
      //       }
      const path = ui.$selection.state.start.path;
      const offset = ui.$selection.state.start.offset;
      const node = methods.findNodeByPath(path) as SlateText | null;
      if (!node) {
        return;
      }
      node.text = node.text.substring(0, offset) + text + node.text.substring(offset);
      if (_start_before_composing && _end_before_composing) {
        ui.$selection.methods.setStartAndEnd({ start: _start_before_composing, end: _end_before_composing });
        _start_before_composing = null;
        _end_before_composing = null;
      }
      ui.$selection.methods.moveForward({ step: text.length });
      methods.apply({ type: "insert_text", wholeText: node.text, text, node, path, offset });
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
    deleteBackward(param: Partial<{ unit: "character" }> = {}) {
      let start = ui.$selection.state.start;
      let end = ui.$selection.state.end;
      const node = methods.findNodeByPath(start.path) as SlateText | null;
      if (!node) {
        return;
      }
      const isSamePoint = SlatePointModel.isSamePoint(start, end);
      console.log("[]deleteBackward - before node.text.substring", node.text, isSamePoint, start.offset, end.offset);
      if (isSamePoint) {
        node.text = node.text.substring(0, start.offset - 1) + node.text.substring(end.offset);
        ui.$selection.methods.moveBackward();
      } else {
        node.text = node.text.substring(0, start.offset) + node.text.substring(end.offset);
        ui.$selection.methods.collapseToStart();
      }
      start = ui.$selection.state.start;
      end = ui.$selection.state.end;
      console.log("[]deleteBackward - after node.text.substring", node.text, node);
      methods.apply({
        type: "delete_text",
        wholeText: node.text,
        text: "",
        node,
        path: start.path,
        offset: start.offset,
      });
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
      _is_composing = false;
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
      _start_before_composing = ui.$selection.state.start;
      _end_before_composing = ui.$selection.state.end;
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

  let _children = props.defaultValue ?? [];
  /** 是否处于 输入合成 中 */
  let _is_composing = false;
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
      //       setTimeout(() => {
      //         methods.getCaretPosition();
      //       }, 0);
    },
    Backspace(event) {
      if (_is_composing) {
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
