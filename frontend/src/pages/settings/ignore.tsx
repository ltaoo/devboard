/**
 * @file 用户配置/粘贴事件忽略
 */
import { For, Match, Show, Switch } from "solid-js";
import { BrushCleaning, Check, Delete, File } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, Input, ScrollView, Textarea } from "@/components/ui";
import { FieldObjV2 } from "@/components/fieldv2/obj";
import { FieldV2 } from "@/components/fieldv2/field";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { ButtonCore, InputCore, ScrollViewCore } from "@/domains/ui";
import { ArrayFieldCore, ObjectFieldCore, SingleFieldCore } from "@/domains/ui/formv2";
import {
  fetchUserSettings,
  registerShortcut,
  unregisterShortcut,
  updateUserSettings,
  updateUserSettingsWithPath,
} from "@/biz/settings/service";
import { debounce } from "@/utils/lodash/debounce";
import { AppSelectViewModel } from "@/biz/paste/select_app";
import { TagSelect, TagSelectModel } from "@/components/select-app";
import { fetchAppList } from "@/biz/paste/service";

function IgnoreSettingsViewModel(props: ViewComponentProps) {
  const request = {
    settings: {
      data: new RequestCore(fetchUserSettings, { client: props.client }),
      update: new RequestCore(updateUserSettings, { client: props.client }),
      update_by_path: new RequestCore(updateUserSettingsWithPath, { client: props.client }),
      register_shortcut: new RequestCore(registerShortcut, { client: props.client }),
      unregister_shortcut: new RequestCore(unregisterShortcut, { client: props.client }),
    },
    app: {
      list: new RequestCore(fetchAppList, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    async ready() {
      (async () => {
        const r = await request.app.list.run();
        if (r.error) {
          return;
        }
        const list = r.data.list;
        ui.$form_settings.fields.apps.input.methods.setOptions(
          list.map((v) => {
            return {
              id: v.id,
              label: v.name,
            };
          })
        );
      })();
      const r = await request.settings.data.run();
      if (r.error) {
        return;
      }
      if (r.data.ignore) {
        ui.$form_settings.setValue(r.data.ignore);
      }
    },
    updateSettingsByPath: debounce(800, (path: string, opt: { value: unknown }) => {
      console.log("[PAGE]settings/settings.tsx - updateSettingsByPath", path, opt.value);
      request.settings.update_by_path.run({ path, value: opt.value });
    }),
  };
  const ui = {
    $view: new ScrollViewCore({}),
    $form_settings: new ObjectFieldCore({
      fields: {
        max_length: new SingleFieldCore({
          label: "最大长度",
          rules: [],
          input: new InputCore({
            defaultValue: 0,
            onChange() {
              methods.updateSettingsByPath("ignore.max_length", {
                value: ui.$form_settings.getValueWithPath(["max_length"]),
              });
            },
          }),
        }),
        filename: new SingleFieldCore({
          label: "文件名",
          rules: [],
          input: new InputCore({
            defaultValue: "",
            onChange() {
              methods.updateSettingsByPath("ignore.filename", {
                value: ui.$form_settings.getValueWithPath(["filename"]),
              });
            },
          }),
        }),
        extension: new SingleFieldCore({
          label: "文件后缀",
          rules: [],
          input: new InputCore({
            defaultValue: "",
            onChange() {
              methods.updateSettingsByPath("ignore.extension", {
                value: ui.$form_settings.getValueWithPath(["extension"]),
              });
            },
          }),
        }),
        apps: new SingleFieldCore({
          label: "应用",
          rules: [],
          input: TagSelectModel({
            defaultValue: [],
            //     request: request.app.list,
            app: props.app,
            //     client: props.client,
            //     onChange() {
            //       methods.updateSettingsByPath("ignore.apps", {
            //         value: ui.$form_settings.getValueWithPath(["apps"]),
            //       });
            //     },
          }),
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

export function IgnoreSettingsView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(IgnoreSettingsViewModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <div class="block">
        <div class="text-2xl text-w-fg-0">配置</div>
        <div class="mt-4 space-y-8">
          <div>
            <FieldV2 store={vm.ui.$form_settings.fields.max_length}>
              <Input store={vm.ui.$form_settings.fields.max_length.input} />
            </FieldV2>
          </div>
          <div>
            <FieldV2 store={vm.ui.$form_settings.fields.filename}>
              <Textarea store={vm.ui.$form_settings.fields.filename.input} />
            </FieldV2>
          </div>
          <div>
            <FieldV2 store={vm.ui.$form_settings.fields.apps}>
              <TagSelect store={vm.ui.$form_settings.fields.apps.input} />
            </FieldV2>
          </div>
        </div>
      </div>
    </ScrollView>
  );
}
