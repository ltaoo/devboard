import { Show } from "solid-js";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { fetchSystemInfo } from "@/biz/system/service";
import { Button, Input } from "@/components/ui";
import { ButtonCore, InputCore } from "@/domains/ui";
import { exportRecordListToFileList, importFileListToRecordList, pingWebDav } from "@/biz/sync/service";
import { ObjectFieldCore, SingleFieldCore } from "@/domains/ui/formv2";
import { FieldObjV2 } from "@/components/fieldv2/obj";
import { FieldV2 } from "@/components/fieldv2/field";
import { Check } from "lucide-solid";

function SystemInfoModel(props: ViewComponentProps) {
  const request = {
    system: {
      info: new RequestCore(fetchSystemInfo, { client: props.client }),
    },
    sync: {
      ping: new RequestCore(pingWebDav, { client: props.client }),
      uploadToWebdav: new RequestCore(exportRecordListToFileList, { client: props.client }),
      downloadFromWebdav: new RequestCore(importFileListToRecordList, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    ready() {
      request.system.info.run();
    },
  };
  const ui = {
    $btn_validate: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          return;
        }
        const body = {
          url: r.data.url,
          username: r.data.username,
          password: r.data.password,
        };
        request.sync.ping.run(body);
      },
    }),
    $btn_export: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          return;
        }
        const body = {
          url: r.data.url,
          username: r.data.username,
          password: r.data.password,
          root_dir: r.data.root_dir,
        };
        request.sync.uploadToWebdav.run(body);
      },
    }),
    $btn_import: new ButtonCore({
      onClick() {
        request.sync.downloadFromWebdav.run();
      },
    }),
    $form_webdav: new ObjectFieldCore({
      fields: {
        url: new SingleFieldCore({
          label: "地址",
          rules: [
            {
              required: true,
            },
          ],
          input: new InputCore({ defaultValue: "https://storage.funzm.com" }),
        }),
        username: new SingleFieldCore({
          label: "用户名",
          input: new InputCore({ defaultValue: "admin" }),
        }),
        password: new SingleFieldCore({
          label: "密码",
          input: new InputCore({ defaultValue: "admin" }),
        }),
        root_dir: new SingleFieldCore({
          label: "同步到该文件夹",
          rules: [
            {
              required: true,
            },
          ],
          input: new InputCore({ defaultValue: "/devboard" }),
        }),
      },
    }),
  };
  let _state = {
    get profile() {
      return request.system.info.response;
    },
    get ping() {
      return request.sync.ping.response;
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

  request.system.info.onStateChange(() => methods.refresh());
  request.sync.ping.onStateChange(() => methods.refresh());

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

export function SystemInfoView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(SystemInfoModel, [props]);

  return (
    <div>
      <Show when={state().profile}>
        <div class="space-y-4">
          <div>
            <div class="text-2xl">本机信息</div>
            <div class="field text-w-fg-0">
              <div>主机名</div>
              <div>{state().profile?.hostname}</div>
            </div>
          </div>
          <div>
            <div class="text-2xl">Webdav</div>
            <FieldObjV2 store={vm.ui.$form_webdav}>
              <FieldV2 store={vm.ui.$form_webdav.fields.url}>
                <Input store={vm.ui.$form_webdav.fields.url.input} />
              </FieldV2>
              <FieldV2 store={vm.ui.$form_webdav.fields.username}>
                <Input store={vm.ui.$form_webdav.fields.username.input} />
              </FieldV2>
              <FieldV2 store={vm.ui.$form_webdav.fields.password}>
                <Input store={vm.ui.$form_webdav.fields.password.input} />
              </FieldV2>
              <FieldV2 store={vm.ui.$form_webdav.fields.root_dir}>
                <Input store={vm.ui.$form_webdav.fields.root_dir.input} />
              </FieldV2>
            </FieldObjV2>
            <div class="space-x-1">
              <Button store={vm.ui.$btn_validate}>
                <div class="flex items-center space-x-1">
                  <Show when={state().ping?.ok}>
                    <Check class="w-4 h-4 text-w-green" />
                  </Show>
                  <div>测试</div>
                </div>
              </Button>
              <Button store={vm.ui.$btn_export}>同步至 webdav</Button>
              <Button store={vm.ui.$btn_import}>从 webdav 同步</Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
