/**
 * @file 用户配置/快捷键
 */
import { For, Match, Show, Switch } from "solid-js";
import { BrushCleaning, Check, Delete, File, X } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, Input, ScrollView, Textarea } from "@/components/ui";
import { FieldObjV2 } from "@/components/fieldv2/obj";
import { FieldV2 } from "@/components/fieldv2/field";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { ButtonCore, InputCore, ScrollViewCore } from "@/domains/ui";
import { ObjectFieldCore, SingleFieldCore } from "@/domains/ui/formv2";
import {
  fetchUserSettings,
  registerShortcut,
  unregisterShortcut,
  updateUserSettings,
  updateUserSettingsWithPath,
} from "@/biz/settings/service";
import { ShortcutModel } from "@/biz/shortcut/shortcut";
import { debounce } from "@/utils/lodash/debounce";
import { listenMultiEvent } from "@/domains/app/utils";

function ShortcutRecordModel(props: { app: ViewComponentProps["app"] }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    startListenKeyEvents() {
      _unlisten = listenMultiEvent([
        props.app.onKeydown((event) => {
          // console.log('[PAGE]props.app.onKeydown - ', event.code);
          if (_pending) {
            return;
          }
          if (event.code === "Escape") {
            methods.handleClickReset();
            return;
          }
          _preparing = false;
          _recording = true;
          methods.refresh();
          event.preventDefault();
          console.log(event.code);
          ui.$shortcut.methods.handleKeydown(event);
        }),
        props.app.onKeyup((event) => {
          if (_pending) {
            return;
          }
          ui.$shortcut.methods.handleKeyup(event);
        }),
      ]);
    },
    setExistingCodes(codes: string) {
      console.log("[DOMAIN]ShortcutRecordModel - setExistingCodes", codes);
      _pending = false;
      _preparing = false;
      _recording = false;
      _completed = true;
      ui.$shortcut.methods.setRecordingCodes(codes);
    },
    handleClickStartRecord() {
      _pending = false;
      _preparing = true;
      methods.startListenKeyEvents();
      methods.refresh();
    },
    handleClickReset() {
      if (ui.$shortcut.state.codes2.length) {
        bus.emit(Events.Unregister, { codes: ui.$shortcut.state.codes2.join("+") });
      }
      _pending = true;
      _preparing = false;
      _recording = false;
      _completed = false;
      ui.$shortcut.methods.reset();
      methods.refresh();
    },
  };
  const ui = {
    $shortcut: ShortcutModel({ mode: "recording" }),
  };

  let _unlisten: () => void = () => {};
  let _pending = true;
  let _preparing = false;
  let _recording = false;
  let _completed = false;
  const _state = {
    get pending() {
      return _pending;
    },
    get preparing() {
      return _preparing;
    },
    get recording() {
      return _recording;
    },
    get completed() {
      return _completed;
    },
    get codes() {
      return ui.$shortcut.state.codes2;
    },
  };

  enum Events {
    Register,
    Unregister,
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.Register]: { codes: string };
    [Events.Unregister]: { codes: string };
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$shortcut.onStateChange(() => methods.refresh());
  ui.$shortcut.onShortcutComplete(() => {
    if (ui.$shortcut.state.codes2.length === 0) {
      return;
    }
    if (ui.$shortcut.state.codes2.length === 1) {
      props.app.tip({
        text: ["必须包含一个修饰键+一个常规键"],
      });
      _preparing = true;
      _recording = false;
      ui.$shortcut.methods.reset();
      methods.refresh();
      return;
    }
    _unlisten();
    _completed = true;
    bus.emit(Events.Register, { codes: ui.$shortcut.state.codes2.join("+") });
  });

  return {
    methods,
    state: _state,
    destroy() {
      _unlisten();
      bus.destroy();
    },
    onRegister(handler: Handler<TheTypesOfEvents[Events.Register]>) {
      return bus.on(Events.Register, handler);
    },
    onUnregister(handler: Handler<TheTypesOfEvents[Events.Unregister]>) {
      return bus.on(Events.Unregister, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}

function ShortcutSettingsViewModel(props: ViewComponentProps) {
  const request = {
    settings: {
      data: new RequestCore(fetchUserSettings, { client: props.client }),
      update_by_path: new RequestCore(updateUserSettingsWithPath, { client: props.client }),
      register_shortcut: new RequestCore(registerShortcut, { client: props.client }),
      unregister_shortcut: new RequestCore(unregisterShortcut, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    async ready() {
      const r = await request.settings.data.run();
      if (r.error) {
        return;
      }
      if (r.data.shortcut.toggle_main_window_visible) {
        ui.$recorder.methods.setExistingCodes(r.data.shortcut.toggle_main_window_visible);
      }
    },
    updateSettingsByPath: debounce(800, (path: string, opt: { value: unknown }) => {
      console.log("[PAGE]settings/settings.tsx - updateSettingsByPath", path, opt.value);
      request.settings.update_by_path.run({ path, value: opt.value });
    }),
  };
  const ui = {
    $view: new ScrollViewCore({}),
    $recorder: ShortcutRecordModel(props),
  };

  let _state = {
    get recorder() {
      return ui.$recorder.state;
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

  ui.$recorder.onStateChange(() => methods.refresh());
  ui.$recorder.onRegister(async (v) => {
    await request.settings.update_by_path.run({ path: "shortcut.toggle_main_window_visible", value: v.codes });
    request.settings.register_shortcut.run({
      shortcut: v.codes,
      command: "ToggleMainWindowVisible",
    });
  });
  ui.$recorder.onUnregister(async (v) => {
    await request.settings.update_by_path.run({ path: "shortcut.toggle_main_window_visible", value: "" });
    request.settings.unregister_shortcut.run({
      shortcut: v.codes,
    });
  });

  return {
    methods,
    ui,
    state: _state,
    ready() {
      methods.ready();
    },
    destroy() {
      ui.$recorder.destroy();
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

export function ShortcutSettingsView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(ShortcutSettingsViewModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <div class="block">
        <div class="text-2xl text-w-fg-0">快捷键</div>
        <div class="mt-4 space-y-8">
          <div class="flex items-center justify-between">
            <div>展示主面板</div>
            <div class="flex items-center h-[32px]">
              <div class="flex items-center gap-1">
                <div class="flex gap-1 p-2 border border-2 border-w-fg-3 rounded-md">
                  <Switch>
                    <Match when={state().recorder.pending}>
                      <div
                        onClick={() => {
                          vm.ui.$recorder.methods.handleClickStartRecord();
                        }}
                      >
                        点击录制
                      </div>
                    </Match>
                    <Match when={state().recorder.preparing}>
                      <div>请按下快捷键</div>
                    </Match>
                    <Match when={state().recorder.recording || state().recorder.completed}>
                      <For each={state().recorder.codes}>
                        {(code, idx) => {
                          return (
                            <>
                              <div>{code}</div>
                              <Show when={idx() < state().recorder.codes.length - 1}>
                                <span>+</span>
                              </Show>
                            </>
                          );
                        }}
                      </For>
                    </Match>
                  </Switch>
                </div>
              </div>
              <div class="w-[24px] p-1">
                <Show when={state().recorder.completed}>
                  <div
                    class="rounded-md cursor-pointer"
                    onClick={() => {
                      vm.ui.$recorder.methods.handleClickReset();
                    }}
                  >
                    <X class="w-6 h-6 text-w-fg-1" />
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollView>
  );
}
