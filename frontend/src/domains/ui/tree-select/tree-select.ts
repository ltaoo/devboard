import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { PopoverCore } from "@/domains/ui/popover";
import { InputCore } from "@/domains/ui/form/input";

export function TreeSelectModel<T extends { id: number | string; label: string; children?: T[] }>(props: {
  nodes: T[];
  /** 是否支持多选 */
  multiple?: boolean;
  /** 当勾选节点时，如果存在子节点，也一起勾选 */
  checkChildNodesAuto?: boolean;
  /** 只可以选择叶节点 */
  onlyLeafNode?: boolean;
  /** 所属层级 */
  level?: number;
  uid?: string;
  ui?: {
    $popover: PopoverCore;
    $input: InputCore<string>;
  };
  value: T["id"][];
  onChange?: (e: { node: T; checked: boolean }) => void;
}) {
  function nodeBuild(n: T, idx: number) {
    const $n = TreeSelectNodeModel({
      node: n,
      value: _value,
      idx,
      level: _level + 1,
      uid: [props.uid, idx].filter((n) => n !== undefined).join("-"),
      onChange: methods.handleChange,
      onRefresh() {
        methods.refresh();
      },
    });
    return $n as any as TreeSelectNodeModel<T>;
  }

  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setNodes(nodes?: T[]) {
      _nodes = nodes ?? [];
      _$nodes = _nodes.map(nodeBuild);
      methods.refresh();
    },
    mapNode(idx: number) {
      return _$nodes[idx];
    },
    appendNode(v: { node: T }) {
      _nodes.push(v.node);
      _$nodes.push(nodeBuild(v.node, _nodes.length));
      methods.refresh();
    },
    removeNode(v: { uid: string }) {
      const $matched = _$nodes.find((n) => n.state.uid === v.uid);
      if ($matched) {
        _nodes = _nodes.filter((n) => n.id !== $matched.state.node.id);
        $matched.destroy();
        _$nodes = _$nodes.filter((n) => n !== $matched);
      }
      methods.refresh();
    },
    findNodeWithUID(uid: string) {
      // console.log("[]TreeSelect - findNodeWithLevelAndIdx");
      for (let i = 0; i < _$nodes.length; i += 1) {
        const $node = _$nodes[i];
        const matched = $node.methods.findNodeWithUID(uid) as any as TreeSelectNodeModel<T>;
        if (matched) {
          return matched;
        }
      }
      return null;
    },
    findParentWithUID(uid: string) {
      // console.log("[]TreeSelect - findNodeWithLevelAndIdx");
      for (let i = 0; i < _$nodes.length; i += 1) {
        const $node = _$nodes[i];
        const matched = $node.methods.findNodeWithUID(uid) as any as TreeSelectNodeModel<T>;
        if (matched) {
          return $node;
        }
      }
      return null;
    },
    appendNodeWithUID(uid: string, node: T) {
      const $node = methods.findNodeWithUID(uid);
      if ($node) {
        $node.methods.appendChild({
          node,
        });
        return true;
      }
      return false;
    },
    setNodeWithUID(uid: string, node: T) {
      const $node = methods.findNodeWithUID(uid);
      if ($node) {
        $node.methods.setNode(node);
        return true;
      }
      return false;
    },
    removeChildNodeWithUID(uid: string) {
      const $matched = _$nodes.find((n) => n.state.uid === uid);
      if ($matched) {
        _nodes = _nodes.filter((n) => n.id !== $matched.state.node.id);
        _$nodes = _$nodes.filter((n) => n !== $matched);
        methods.refresh();
        return true;
      }
      return false;
    },
    searchNodeWithUIDThenRemove(uid: string) {
      // const $node = methods.findParentWithUID(uid);
      // if ($node) {
      //   console.log("[]removeNodeWithUID - 1", $node.state.uid, uid);
      //   return $node.methods.removeChildNodeWithUID(uid);
      // }
      // console.log("[]removeNodeWithUID - 3");
      // return false;
      for (let i = 0; i < _$nodes.length; i += 1) {
        const $node = _$nodes[i];
        const matched = $node.methods.findNodeWithUID(uid) as any as TreeSelectNodeModel<T>;
        if (matched) {
          console.log("[]removeNodeWithUID - i-----", props.uid, $node.state.uid, uid);
          if ($node.state.uid === uid) {
            methods.removeChildNodeWithUID(uid);
            return true;
          }
          return $node.methods.removeChildNodeWithUID(uid);
        }
      }
      return null;
    },
    handleChange(e: { node: T; checked: boolean }) {
      _value = (() => {
        if (e.checked) {
          if (_multiple) {
            return [..._value, e.node.id];
          }
          return [e.node.id];
        }
        return [..._value].filter((v) => v !== e.node.id);
      })();
      console.log("[COMPONENT]media/CategoryTreeInput", _value);
      props.onChange?.(e);
      bus.emit(Events.Change, [..._value]);
    },
  };
  const ui = {
    // $popover: props.ui?.$popover ?? new PopoverCore({}),
    // $input: props.ui?.$input ?? new InputCore({ defaultValue: "" }),
  };

  let _multiple = props.multiple ?? true;
  let _nodes = props.nodes;
  let _level = props.level ?? 0;
  let _$nodes = _nodes.map(nodeBuild);
  let _value = props.value;
  let _state = {
    get nodes() {
      return _nodes;
    },
    get value() {
      return _value;
    },
  };
  enum Events {
    Change,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Change]: typeof _value;
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  const $ins = {
    Symbol: "TreeSelectModel" as const,
    shape: "input" as const,
    methods,
    ui,
    state: _state,
    get defaultValue() {
      return _value;
    },
    get value() {
      return _value;
    },
    setValue(v: number[]) {
      _value = v;
    },
    ready() {},
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onChange(handler: Handler<TheTypesOfEvents[Events.Change]>) {
      return bus.on(Events.Change, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
  return $ins;
}
export type TreeSelectModel<T extends { id: number | string; label: string; children?: T[] }> = ReturnType<
  typeof TreeSelectModel<T>
>;

export function TreeSelectNodeModel<T extends { id: number | string; label: string; children?: T[] }>(props: {
  node: T;
  uid: string;
  idx: number;
  level: number;
  value: T["id"][];
  // $parent: TreeSelectModel<T>;
  onDelete?: (e: { node: T }) => void;
  onChange: (e: { node: T; checked: boolean }) => void;
  onRefresh: () => void;
}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    isChecked() {
      return _value.includes(_node.id);
    },
    findNodeWithUID(uid: string) {
      // console.log("[]TreeSelectNode - findNodeWithLevelAndIdx", _level, _idx, uid);
      const isMatched = _uid === uid;
      if (isMatched) {
        return $ins;
      }
      return ui.$children.methods.findNodeWithUID(uid);
    },
    appendChild(v: { node: T }) {
      ui.$children.methods.appendNode(v);
    },
    removeChildNodeWithUID(uid: string) {
      // const ok = ui.$children.methods.removeChildNodeWithUID(uid) as any as boolean;
      // return ok;
      const ok = ui.$children.methods.searchNodeWithUIDThenRemove(uid) as any as boolean;
      return ok;
    },
    setNode(v: T) {
      _node = v;
      methods.refresh();
    },
    setLabel(v: string) {
      _node.label = v;
      methods.refresh();
    },
    // handleEdit(event: { x: number; y: number }) {
    //   ui.$input.setValue(_node.label);
    //   ui.$popover.toggle({ x: event.x, y: event.y });
    // },
    // handlePlus(event: { x: number; y: number }) {
    //   ui.$input.setValue("");
    //   ui.$popover.toggle({ x: event.x, y: event.y });
    // },
    // handleDelete(e: {}) {
    //   console.log("[COMPONENT]CategoryTreeNode - onChange", e);
    //   const { node } = props;
    //   props.onDelete?.({
    //     node,
    //   });
    // },
    handleChange(e: { checked: boolean }) {
      console.log("[COMPONENT]CategoryTreeNode - onChange", e);
      const { node } = props;
      props.onChange?.({
        node,
        checked: e.checked,
      });
    },
  };
  const ui = {
    $children: TreeSelectModel({
      nodes: [],
      value: props.value,
      level: props.level,
      uid: props.uid,
      onChange: props.onChange,
    }),
    // $popover: props.ui.$popover,
    // $input: props.ui.$input,
  };

  //   let _nodes = props.nodes;
  // let _id = props.node.id;
  // let _label = props.node.label;
  let _children = props.node.children;
  let _node = props.node;
  let _idx = props.idx ?? 1;
  let _level = props.level ?? 0;
  let _uid = [props.uid, _idx].join("-");
  let _value = props.value ?? [];
  let _state = {
    get uid() {
      return _uid;
    },
    get idx() {
      return _idx;
    },
    get level() {
      return _level;
    },
    get value() {
      return _value;
    },
    get node() {
      return _node;
    },
    get children() {
      return _children;
    },
    // CategoryNode & { value?: number[]; onChange?: (ids: number[]) => void }
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

  ui.$children.methods.setNodes(_children);
  if (props.onRefresh) {
    bus.on(Events.StateChange, props.onRefresh);
  }

  const $ins = {
    Symbol: "TreeSelectNodeModel" as const,
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
  return $ins;
}

export type TreeSelectNodeModel<T extends { id: number | string; label: string; children?: T[] }> = ReturnType<
  typeof TreeSelectNodeModel<T>
>;
