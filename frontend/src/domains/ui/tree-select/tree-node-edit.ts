import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { PopoverCore } from "@/domains/ui/popover";
import { InputCore } from "@/domains/ui/form/input";
import { ButtonCore } from "@/domains/ui/button";

export function TreeNodeEditModel<T extends { id: number | string; label: string; children?: T[] }>(props: {
  onEdit?: (v: { node: T; level: number; idx: number; uid: string; value: string }) => void;
  onDelete?: (v: { level: number; idx: number; uid: string; node: T }) => void;
  onCreate?: (v: { level: number; idx: number; uid: string; value: string }) => void;
  //   onChecked?: () => void;
}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setPayload(v: { level: number; idx: number; uid: string; node: T }) {
      _payload = v;
      methods.refresh();
    },
    handleEdit(event: { x: number; y: number }) {
      _action = "edit";
      ui.$input.setValue(_payload?.node.label ?? "");
      ui.$popover.toggle({ x: event.x, y: event.y });
    },
    handlePlus(event: { x: number; y: number }) {
      _action = "create";
      ui.$input.setValue("");
      ui.$popover.toggle({ x: event.x, y: event.y });
    },
    handleDelete(e: {}) {
      console.log("[COMPONENT]CategoryTreeNode - onChange", e);
      if (_payload) {
        bus.emit(Events.Delete, { node: _payload.node, level: _payload.level, idx: _payload.idx, uid: _payload.uid });
      }
      //       const { node } = props;
      //       props.onDelete?.({
      //         node,
      //       });
    },
    handleChecked(e: { checked: boolean }) {
      console.log("[COMPONENT]CategoryTreeNode - onChange", e);
      //       const { node } = props;
      //       props.onChange?.({
      //         node,
      //         checked: e.checked,
      //       });
    },
  };
  const ui = {
    $popover: new PopoverCore({}),
    $input: new InputCore({ defaultValue: "" }),
    $btn_cancel: new ButtonCore({
      onClick() {
        ui.$popover.hide();
      },
    }),
    $btn_ok: new ButtonCore({
      onClick() {
        const v = ui.$input.value;
        if (_action === "create" && _payload) {
          bus.emit(Events.Create, { level: _payload.level, idx: _payload.idx, uid: _payload.uid, value: v });
          return;
        }
        if (_action === "edit" && _payload) {
          bus.emit(Events.Edit, {
            node: _payload.node,
            level: _payload.level,
            idx: _payload.idx,
            uid: _payload.uid,
            value: v,
          });
          return;
        }
        // ui.$popover.hide();
      },
    }),
  };

  let _payload: null | { level: number; idx: number; uid: string; node: T } = null;
  let _action: "edit" | "create" | null = null;
  let _state = {};
  enum Events {
    Edit,
    Create,
    Delete,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Create]: { level: number; idx: number; uid: string; value: string };
    [Events.Edit]: { node: T; level: number; idx: number; uid: string; value: string };
    [Events.Delete]: { node: T; level: number; idx: number; uid: string };
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  if (props.onCreate) {
    bus.on(Events.Create, props.onCreate);
  }
  if (props.onEdit) {
    bus.on(Events.Edit, props.onEdit);
  }
  if (props.onDelete) {
    bus.on(Events.Delete, props.onDelete);
  }

  return {
    methods,
    ui,
    state: _state,
    ready() {},
    destroy() {
      bus.destroy();
    },
    onCreate(handler: Handler<TheTypesOfEvents[Events.Create]>) {
      return bus.on(Events.Create, handler);
    },
    onEdit(handler: Handler<TheTypesOfEvents[Events.Edit]>) {
      return bus.on(Events.Edit, handler);
    },
    onDelete(handler: Handler<TheTypesOfEvents[Events.Delete]>) {
      return bus.on(Events.Delete, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}

export type TreeNodeEditModel = ReturnType<typeof TreeNodeEditModel>;
