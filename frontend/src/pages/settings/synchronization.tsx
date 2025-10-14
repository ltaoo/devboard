import { For, Show } from "solid-js";
import { Check, File } from "lucide-solid";
import { Events as WailsEvents } from "@wailsio/runtime";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, Input, ScrollView } from "@/components/ui";
import { FieldObjV2 } from "@/components/fieldv2/obj";
import { FieldV2 } from "@/components/fieldv2/field";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { ButtonCore, InputCore, ScrollViewCore } from "@/domains/ui";
import { ObjectFieldCore, SingleFieldCore } from "@/domains/ui/formv2";
import { syncToRemote, syncFromRemote, pingWebDav, fetchDatabaseDirs } from "@/biz/synchronize/service";
import { fetchSystemInfo } from "@/biz/system/service";
import { highlightFileInFolder } from "@/biz/fs/service";
import { fetchUserSettings, updateUserSettings } from "@/biz/settings/service";

function SynchronizationViewModel(props: ViewComponentProps) {
  const request = {
    file: {
      highlight: new RequestCore(highlightFileInFolder, { client: props.client }),
    },
    settings: {
      data: new RequestCore(fetchUserSettings, { client: props.client }),
      update: new RequestCore(updateUserSettings, { client: props.client }),
    },
    sync: {
      database: new RequestCore(fetchDatabaseDirs, { client: props.client }),
      ping: new RequestCore(pingWebDav, { client: props.client }),
      uploadToWebdav: new RequestCore(syncToRemote, { client: props.client }),
      downloadFromWebdav: new RequestCore(syncFromRemote, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    async refreshWebdavSettings() {
      const r = await request.settings.data.run();
      if (r.error) {
        return;
      }
      const { douyin, synchronize } = r.data;
      if (synchronize?.webdav) {
        ui.$form_webdav.setValue(synchronize?.webdav);
      }
    },
    ready() {
      methods.refreshWebdavSettings();
      request.sync.database.run();
    },
    handleClickField(dir: { text: string }) {
      request.file.highlight.run({ file_path: dir.text });
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
    $btn_validate: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
          return;
        }
        const body = {
          url: r.data.url,
          username: r.data.username,
          password: r.data.password,
          root_dir: r.data.root_dir,
        };
        request.settings.update.run({
          ...request.settings.data.response,
          synchronize: {
            webdav: body,
          },
        });
        request.sync.ping.run(body);
      },
    }),
    $btn_prepare_export: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
          return;
        }
        const body = {
          url: r.data.url,
          username: r.data.username,
          password: r.data.password,
          root_dir: r.data.root_dir,
          test: true,
        };
        const r2 = await request.sync.uploadToWebdav.run(body);
        if (r2.error) {
          return;
        }
        console.log(r2.data);
      },
    }),
    $btn_export: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
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
    $btn_prepare_import: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
          return;
        }
        const body = {
          url: r.data.url,
          username: r.data.username,
          password: r.data.password,
          root_dir: r.data.root_dir,
          test: true,
        };
        request.sync.downloadFromWebdav.run(body);
      },
    }),
    $btn_import: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
          return;
        }
        const body = {
          url: r.data.url,
          username: r.data.username,
          password: r.data.password,
          root_dir: r.data.root_dir,
        };
        request.sync.downloadFromWebdav.run(body);
      },
    }),
    $btn_synchronize: new ButtonCore({
      async onClick() {
        const r = await ui.$form_webdav.validate();
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
          return;
        }
        const body = {
          url: r.data.url,
          username: r.data.username,
          password: r.data.password,
          root_dir: r.data.root_dir,
        };
        ui.$btn_synchronize.setLoading(true);
        const r2 = await request.sync.downloadFromWebdav.run(body);
        if (r2.error) {
          ui.$btn_synchronize.setLoading(false);
          return;
        }
        const r3 = await request.sync.uploadToWebdav.run(body);
        ui.$btn_synchronize.setLoading(false);
        if (r3.error) {
          return;
        }
        props.app.tip({
          text: ["同步完成"],
        });
        WailsEvents.Emit({ name: "m:refresh", data: {} });
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
          input: new InputCore({ defaultValue: "" }),
        }),
        username: new SingleFieldCore({
          label: "用户名",
          input: new InputCore({ defaultValue: "" }),
        }),
        password: new SingleFieldCore({
          label: "密码",
          input: new InputCore({ defaultValue: "" }),
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
    get database() {
      return request.sync.database.response;
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

  request.sync.database.onStateChange(() => methods.refresh());
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

export function SynchronizationView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(SynchronizationViewModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <div class="space-y-8">
        <div class="block">
          <div class="text-2xl">数据</div>
          <div class="mt-4 space-y-2">
            <For each={state().database?.fields}>
              {(field) => {
                return (
                  <div
                    class="field text-w-fg-0 cursor-pointer"
                    onClick={() => {
                      vm.methods.handleClickField(field);
                    }}
                  >
                    <div>{field.label}</div>
                    <div class="flex items-center gap-1">
                      <File class="w-4 h-4 text-w-fg-0" />
                      <div>{field.text}</div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
        <div class="block">
          <div class="text-2xl">Webdav</div>
          <div class="mt-4">
            <FieldObjV2 class="space-y-2" store={vm.ui.$form_webdav}>
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
          </div>
          <div class="mt-4 space-y-1">
            <div class="space-x-1">
              <Button store={vm.ui.$btn_validate}>
                <div class="flex items-center space-x-1">
                  <Show when={state().ping?.ok}>
                    <Check class="w-4 h-4 text-w-green" />
                  </Show>
                  <div>测试并保存</div>
                </div>
              </Button>
              <Button store={vm.ui.$btn_synchronize}>同步</Button>
            </div>
            {/* <div class="flex space-x-1">
              <Button store={vm.ui.$btn_prepare_export}>测试同步至 webdav</Button>
              <Button store={vm.ui.$btn_export}>同步至 webdav</Button>
            </div>
            <div class="flex space-x-1">
              <Button store={vm.ui.$btn_prepare_import}>测试从 webdav 同步</Button>
              <Button store={vm.ui.$btn_import}>从 webdav 同步</Button>
            </div> */}
          </div>
        </div>
      </div>
    </ScrollView>
  );
}
