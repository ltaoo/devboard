/**
 * @file 用户配置
 */
import { For, Show } from "solid-js";
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
import { ShortcutKey } from "@/components/shortcut";

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
    $shortcut: ShortcutModel({}),
  };

  let _state = {
    get codes() {
      return ui.$shortcut.state.codes;
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
  ui.$shortcut.onStateChange(() => methods.refresh());

  const unlistens = [
    props.app.onKeydown((event) => {
      ui.$shortcut.methods.handleKeydown(event);
    }),
    props.app.onKeyup((event) => {
      ui.$shortcut.methods.handleKeyup(event);
    }),
  ];

  return {
    methods,
    ui,
    state: _state,
    ready() {
      methods.ready();
    },
    destroy() {
      for (let i = 0; i < unlistens.length; i += 1) {
        unlistens[i]();
      }
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
          <div class="flex">
            <ShortcutKey keys={state().codes} />
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
