import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

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
  };
  const ui = {};
  let _state = {};
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
  type: "insert_text";
  /** 操作的文本*/
  text: string;
  /** 操作位置 */
  offset: number;
  /** 操作节点路径 */
  path: number[];
};

export function SlateEditorModel() {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    _insertText(text: string, options: TextInsertTextOptions = {}) {},
    apply(operation: SlateOperation) {},
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
    },
    handleKeyDown(event: KeyDownEvent) {
      if (_is_composing && !event.nativeEvent.isComposing) {
        _is_composing = false;
      }
      if (_is_composing) {
        return;
      }
      // 判断是否移动光标
    },
  };
  const ui = {
    $selection: SlateSelectionModel(),
  };

  /** 是否处于 输入合成 中 */
  let _is_composing = false;
  let _is_updating_selection = false;
  let _is_focus = true;
  //   let _children: Descendant[] = [];
  //   let _decorations: DecoratedRange[] = [];
  //   let _node: Ancestor;
  let _state = {
    get isFocus() {
      return _is_focus;
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
    get isFocus() {
      return _state.isFocus;
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

export type SlateEditorModel = ReturnType<typeof SlateEditorModel>;
