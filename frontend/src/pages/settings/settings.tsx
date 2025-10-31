/**
 * @file 用户配置
 */
import { For, Match, Show, Switch } from "solid-js";
import { Check, File } from "lucide-solid";

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

function ShortcutRecordModel(props: { app: ViewComponentProps["app"] }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    startListenKeyEvents() {
      const cancelers = [
        props.app.onKeydown((event) => {
          if (_pending) {
            return;
          }
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
      ];
      _unlisten = function () {
        for (let i = 0; i < cancelers.length; i += 1) {
          const canc = cancelers[i];
          canc();
        }
      };
    },
    setExistingCodes(codes: string) {
      console.log("[DOMAIN]ShortcutRecordModel - setExistingCodes", codes);
      _pending = false;
      _recording = false;
      _completed = true;
      ui.$shortcut.methods.setRecordingCodes(codes);
    },
    handleClickStartRecord() {
      _pending = false;
      _recording = true;
      methods.startListenKeyEvents();
      methods.refresh();
    },
    handleClickReset() {
      bus.emit(Events.Unregister, { codes: ui.$shortcut.state.codes2.join("+") });
      _pending = true;
      _recording = false;
      _completed = false;
      ui.$shortcut.methods.reset();
      methods.startListenKeyEvents();
      methods.refresh();
    },
  };
  const ui = {
    $shortcut: ShortcutModel({ mode: "recording" }),
  };

  let _unlisten: null | (() => void) = null;
  let _pending = true;
  let _recording = false;
  let _completed = false;
  const _state = {
    get pending() {
      return _pending;
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
    if (_unlisten) {
      _unlisten();
    }
    _completed = true;
    bus.emit(Events.Register, { codes: ui.$shortcut.state.codes2.join("+") });
  });

  return {
    methods,
    state: _state,
    destroy() {
      if (_unlisten) {
        _unlisten();
      }
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

function SettingsViewModel(props: ViewComponentProps) {
  const request = {
    settings: {
      data: new RequestCore(fetchUserSettings, { client: props.client }),
      update: new RequestCore(updateUserSettings, { client: props.client }),
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
      ui.$form_settings.setValue(r.data);
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
    $btn_submit: new ButtonCore({
      async onClick() {
        const r = await ui.$form_settings.fields.douyin.validate();
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
          return;
        }
        const body = {
          douyin: {
            cookie: r.data.cookie,
          },
        };
        const r2 = await request.settings.update.run(body);
        if (r2.error) {
          return;
        }
        props.app.tip({
          text: ["Update Success"],
        });
      },
    }),
    $form_settings: new ObjectFieldCore({
      fields: {
        douyin: new ObjectFieldCore({
          label: "抖音",
          fields: {
            cookie: new SingleFieldCore({
              label: "Cookie",
              rules: [
                {
                  required: true,
                },
              ],
              input: new InputCore({
                defaultValue: "",
                onChange() {
                  methods.updateSettingsByPath("douyin.cookie", {
                    value: ui.$form_settings.getValueWithPath(["douyin", "cookie"]),
                  });
                },
              }),
            }),
          },
        }),
        paste_event: new ObjectFieldCore({
          label: "粘贴事件",
          fields: {
            callback_endpoint: new SingleFieldCore({
              label: "回调地址",
              rules: [
                {
                  required: true,
                },
              ],
              input: new InputCore({
                defaultValue: "",
                onChange() {
                  methods.updateSettingsByPath("paste_event.callback_endpoint", {
                    value: ui.$form_settings.getValueWithPath(["paste_event", "callback_endpoint"]),
                  });
                },
              }),
            }),
          },
        }),
      },
    }),
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

  request.settings.data.onStateChange(() => methods.refresh());
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

export function SettingsView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(SettingsViewModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <div class="block">
        <div class="text-2xl text-w-fg-0">配置</div>
        <div class="mt-4 space-y-8">
          <div class="h-[32px]">
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
              <Match when={state().recorder.recording || state().recorder.completed}>
                <div class="flex gap-1">
                  <For each={state().recorder.codes}>
                    {(code) => {
                      return (
                        <div>
                          <div>{code}</div>
                        </div>
                      );
                    }}
                  </For>
                </div>
                <Show when={state().recorder.completed}>
                  <div
                    onClick={() => {
                      vm.ui.$recorder.methods.handleClickReset();
                    }}
                  >
                    Reset
                  </div>
                </Show>
              </Match>
            </Switch>
          </div>
          <div>
            <FieldObjV2 class="space-y-2" store={vm.ui.$form_settings.fields.douyin}>
              <FieldV2 store={vm.ui.$form_settings.fields.douyin.fields.cookie}>
                <Textarea store={vm.ui.$form_settings.fields.douyin.fields.cookie.input} />
              </FieldV2>
            </FieldObjV2>
          </div>
          <div>
            <FieldObjV2 class="space-y-2" store={vm.ui.$form_settings.fields.paste_event}>
              <FieldV2 store={vm.ui.$form_settings.fields.paste_event.fields.callback_endpoint}>
                <Textarea
                  spellcheck={false}
                  store={vm.ui.$form_settings.fields.paste_event.fields.callback_endpoint.input}
                />
              </FieldV2>
            </FieldObjV2>
          </div>
        </div>
      </div>
    </ScrollView>
  );
}
