import { base, Handler } from "@/domains/base";
import { HttpClientCore } from "@/domains/http_client";
import { RequestCore, TheResponseOfRequestCore } from "@/domains/request";
import { PopoverCore, SelectCore } from "@/domains/ui";

import { DeviceSummary, fetchDeviceList } from "./service";

export function DeviceSelectViewModel(props: {
  defaultValue: { id: number | string }[];
  disabled?: boolean;
  client: HttpClientCore;
  onLoaded?: (list: DeviceSummary[]) => void;
}) {
  let _disabled = props.disabled ?? false;
  let _selected: { id: number | string }[] = [];
  let list: DeviceSummary[];
  let _state = {
    get value() {
      return _selected.flatMap((item) => {
        const matched = list.find((m) => m.id === item.id);
        if (!matched) {
          return [];
        }
        return [matched];
      });
    },
    get muscles() {
      return list;
    },
    get disabled() {
      return _disabled;
    },
  };
  const request = {
    list: new RequestCore(fetchDeviceList, { client: props.client }),
  };
  const methods = {
    select(muscle: { id: number | string }) {
      const existing = _selected.find((item) => item.id === muscle.id);
      if (existing) {
        _selected = _selected.filter((item) => item.id !== muscle.id);
      } else {
        _selected.push(muscle);
      }
      bus.emit(Events.StateChange, { ..._state });
    },
    remove(muscle: { id: number | string }) {
      _selected = _selected.filter((item) => item.id !== muscle.id);
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $dropdown: new SelectCore({
      defaultValue: "",
      options: [],
    }),
    $popover: new PopoverCore(),
  };
  enum Events {
    Change,
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.Change]: typeof _selected;
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();
  request.list.onSuccess((muscles) => {
    props.onLoaded?.(muscles.list);
  });
  request.list.onStateChange((state) => {
    console.log("[BIZ]muscle_select - request.muscle.list.onStateChange", state.response);
    if (!state.response) {
      return;
    }
    list = state.response.list;
    bus.emit(Events.StateChange, { ..._state });
  });

  return {
    shape: "custom" as const,
    type: "device_select",
    state: _state,
    methods,
    ui,
    get value() {
      return _selected;
    },
    get defaultValue() {
      return props.defaultValue;
    },
    setValue(value: { id: number | string }[]) {
      _selected = value;
    },
    ready() {
      request.list.run();
    },
    onChange(handler: Handler<TheTypesOfEvents[Events.Change]>) {
      return bus.on(Events.Change, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}

export type DeviceSelectViewModel = ReturnType<typeof DeviceSelectViewModel>;
