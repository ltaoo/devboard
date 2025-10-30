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
import { fetchUserSettings, updateUserSettings } from "@/biz/settings/service";
import { ShortcutModel } from "@/biz/shortcut/shortcut";

function ShortcutRecordModel(props: { app: ViewComponentProps["app"] }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    handleClick() {
      _pending = false;
      methods.refresh();
    },
  };
  const ui = {
    $shortcut: ShortcutModel({}),
  };

  let _pending = true;
  const _state = {
    get pending() {
      return _pending;
    },
    get codes() {
      return ui.$shortcut.state.codes;
    },
  };

  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$shortcut.onStateChange(() => methods.refresh());

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

  return {
    methods,
    state: _state,
    destroy() {
      for (let i = 0; i < cancelers.length; i += 1) {
        cancelers[i]();
      }
      bus.destroy();
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
    },
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
              input: new InputCore({ defaultValue: "" }),
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
              input: new InputCore({ defaultValue: "" }),
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
                    vm.ui.$recorder.methods.handleClick();
                  }}
                >
                  点击录制
                </div>
              </Match>
              <Match when={!state().recorder.pending}>
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
                <Textarea store={vm.ui.$form_settings.fields.paste_event.fields.callback_endpoint.input} />
              </FieldV2>
            </FieldObjV2>
          </div>
        </div>
        <div class="mt-4 space-x-1">
          <Button store={vm.ui.$btn_submit}>提交</Button>
        </div>
      </div>
    </ScrollView>
  );
}
