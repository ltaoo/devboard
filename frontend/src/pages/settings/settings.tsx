/**
 * @file 用户配置
 */
import { For, Match, Show, Switch } from "solid-js";
import { BrushCleaning, Check, Delete, File } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, Checkbox, Input, ScrollView, Textarea } from "@/components/ui";
import { FieldObjV2 } from "@/components/fieldv2/obj";
import { FieldV2 } from "@/components/fieldv2/field";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { ButtonCore, CheckboxCore, InputCore, ScrollViewCore } from "@/domains/ui";
import { ObjectFieldCore, SingleFieldCore } from "@/domains/ui/formv2";
import {
  fetchUserSettings,
  registerShortcut,
  toggleAutoStart,
  unregisterShortcut,
  updateUserSettings,
  updateUserSettingsWithPath,
} from "@/biz/settings/service";
import { debounce } from "@/utils/lodash/debounce";

function SettingsViewModel(props: ViewComponentProps) {
  const request = {
    settings: {
      data: new RequestCore(fetchUserSettings, { client: props.client }),
      update: new RequestCore(updateUserSettings, { client: props.client }),
      update_by_path: new RequestCore(updateUserSettingsWithPath, { client: props.client }),
      register_shortcut: new RequestCore(registerShortcut, { client: props.client }),
      unregister_shortcut: new RequestCore(unregisterShortcut, { client: props.client }),
    },
    auto_start: {
      update: new RequestCore(toggleAutoStart, { client: props.client }),
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
        auto_start: new SingleFieldCore({
          label: "开机启动",
          input: new CheckboxCore({
            onChange() {
              const v = ui.$form_settings.getValueWithPath(["auto_start"]);
              methods.updateSettingsByPath("auto_start", {
                value: v,
              });
              request.auto_start.update.run({
                auto_start: v,
              });
            },
          }),
        }),
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
  };

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

  request.settings.data.onStateChange(() => methods.refresh());

  return {
    methods,
    ui,
    state: _state,
    ready() {
      methods.ready();
    },
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

export function SettingsView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(SettingsViewModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <div class="block">
        <div class="text-2xl text-w-fg-0">配置</div>
        <div class="mt-4 space-y-8">
          <div>
            <FieldV2 store={vm.ui.$form_settings.fields.auto_start}>
              <Checkbox store={vm.ui.$form_settings.fields.auto_start.input} />
            </FieldV2>
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
