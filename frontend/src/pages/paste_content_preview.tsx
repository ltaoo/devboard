/**
 * @file 粘贴板内容预览
 */
import { For, Match, Show, Switch } from "solid-js";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { JSONContentPreview } from "@/components/preview-panels/json";
import { CodeCard } from "@/components/code-card";
import { HTMLCard } from "@/components/html-card";
import { ImageContentPreview } from "@/components/preview-panels/image";
import { Button, ScrollView, Textarea } from "@/components/ui";
import { ModelInList } from "@/components/dynamic-content/with-click";

import { ButtonCore, InputCore, ScrollViewCore } from "@/domains/ui";
import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { PasteEventProfileModel } from "@/biz/paste/paste_profile";
import { isCodeContent } from "@/biz/paste/utils";
import { PasteContentImage, PasteContentType } from "@/biz/paste/service";
import { RequestCore } from "@/domains/request";
import { createRemark, deleteRemark } from "@/biz/remark/service";

function PreviewPasteEventModel(props: ViewComponentProps) {
  const $profile = PasteEventProfileModel(props);

  const request = {
    remark: {
      create: new RequestCore(createRemark, { client: props.client }),
      delete: new RequestCore(deleteRemark, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    async ready() {
      $profile.methods.load(props.view.query.id);
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
    $textarea_remark: new InputCore({
      defaultValue: "",
      onEnter() {
        ui.$btn_create_remark.click();
      },
    }),
    $btn_create_remark: new ButtonCore({
      async onClick() {
        const content = ui.$textarea_remark.value;
        if (!content) {
          props.app.tip({
            text: ["请输入内容"],
          });
          return;
        }
        const paste_id = props.view.query.id;
        if (!paste_id) {
          props.app.tip({
            text: ["异常操作"],
          });
          return;
        }
        props.app.tip({
          text: [content],
        });
        ui.$btn_create_remark.setLoading(true);
        await request.remark.create.run({ content, paste_event_id: paste_id });
        ui.$btn_create_remark.setLoading(false);
        ui.$textarea_remark.clear();
        $profile.methods.reloadRemarks();
      },
    }),
    $list_btn_delete_remark: ModelInList<ButtonCore>({}),
  };

  let _state = {
    get profile() {
      return $profile.state.profile;
    },
    get error() {
      return $profile.state.error;
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

  $profile.onStateChange(() => {
    const remarks = $profile.state.profile?.remark.dataSource;
    // console.log("[PAGE]paste_event_profile - $profile.state.profile?.remark.dataSource", remarks);
    if (remarks?.length) {
      for (let i = 0; i < remarks.length; i += 1) {
        const v = remarks[i];
        ui.$list_btn_delete_remark.methods.set(
          v.id,
          () =>
            new ButtonCore({
              async onClick() {
                $profile.methods.deleteRemark(v);
              },
            })
        );
      }
    }
    methods.refresh();
  });

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

export function PreviewPasteEventView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(PreviewPasteEventModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="relative w-full h-full">
      <Switch>
        <Match when={state().error}>
          <div>{state().error?.message}</div>
        </Match>
        <Match when={state().profile}>
          <div class="content flex h-full">
            <div class="content__preview relative flex-1 w-0 h-full">
              <Switch
                fallback={
                  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[60vw] p-4 rounded-md bg-w-bg-3">
                    <div class="break-all">{state().profile?.text!}</div>
                  </div>
                }
              >
                <Match when={state().profile?.type === "html"}>
                  <div class="overflow-y-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[60vw] max-h-[80vh] p-4 rounded-md bg-w-bg-3">
                    <HTMLCard html={state().profile!.text!} />
                  </div>
                </Match>
                <Match when={state().profile?.type === "image"}>
                  <Show when={state().profile!.image_url}>
                    <ImageContentPreview url={state().profile!.image_url!} />
                  </Show>
                </Match>
                <Match when={state().profile?.type === "file"}>
                  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[60vw] p-4 rounded-md bg-w-bg-3">
                    <For each={state().profile?.files}>
                      {(file) => {
                        return (
                          <div>
                            <div class="text-w-fg-0">{file.name}</div>
                            <div class="text-sm text-w-fg-1">{file.absolute_path}</div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </Match>
                <Match when={state().profile?.types?.includes("JSON")}>
                  <JSONContentPreview text={state().profile?.text!} />
                </Match>
                <Match when={isCodeContent(state().profile?.types)}>
                  <CodeCard
                    id={state().profile?.id!}
                    language={state().profile?.language}
                    linenumber
                    code={state().profile?.text!}
                  />
                </Match>
              </Switch>
            </div>
            <div class="content_profile overflow-y-auto w-[280px] h-full p-4 bg-w-bg-3">
              <div>
                <div class="paste_categories flex gap-1">
                  <For each={state().profile?.categories}>
                    {(cate) => {
                      return (
                        <div class="px-2 py-1 rounded-md bg-w-fg-3">
                          <div class="text-w-fg-0 text-[12px]">{cate.label}</div>
                        </div>
                      );
                    }}
                  </For>
                </div>
                <Show when={state().profile?.details}>
                  <div class="paste__profile mt-4">
                    <Show when={state().profile?.details?.type === PasteContentType.Image}>
                      <div class="details__image text-w-fg-0">
                        <div>
                          <div class="text-w-fg-1 text-[12px]">宽高</div>
                          <div class="flex items-center">
                            <div>{(state().profile?.details?.data as PasteContentImage).width}</div>
                            <div>x</div>
                            <div>{(state().profile?.details?.data as PasteContentImage).height}</div>
                          </div>
                        </div>
                        <div class="">
                          <div class="text-w-fg-1 text-[12px]">大小</div>
                          <div>{(state().profile?.details?.data as PasteContentImage).size_for_humans}</div>
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
                <div class="fields mt-4 space-y-2">
                  <div class="field">
                    <div class="text-w-fg-1 text-[12px]">创建时间</div>
                    <div class="text-w-fg-0">{state().profile?.created_at_text}</div>
                  </div>
                  <div class="field text-w-fg-1 text-sm">
                    <div class="text-w-fg-1 text-[12px]">应用</div>
                    <div class="text-w-fg-0">{state().profile?.app.name}</div>
                  </div>
                  <div class="field text-w-fg-1 text-sm">
                    <div class="text-w-fg-1 text-[12px]">设备</div>
                    <div class="text-w-fg-0">{state().profile?.device.name}</div>
                  </div>
                </div>
                <div class="remark mt-2 text-w-fg-0">
                  <div class="text-w-fg-1 text-[12px]">备注</div>
                  <div class="mt-1 space-y-1">
                    <For each={state().profile?.remark.dataSource}>
                      {(remark) => {
                        return (
                          <div>
                            <div>{remark.content}</div>
                            <div class="flex items-center justify-between">
                              <div class="text-w-fg-1 text-[12px]">{remark.created_at_text}</div>
                              <div>
                                <Show when={vm.ui.$list_btn_delete_remark.methods.get(remark.id)}>
                                  <Button size="sm" store={vm.ui.$list_btn_delete_remark.methods.get(remark.id)!}>
                                    删除
                                  </Button>
                                </Show>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                  <div class="mt-2">
                    <Textarea
                      spellcheck={false}
                      autocapitalize="off"
                      autoCapitalize="off"
                      store={vm.ui.$textarea_remark}
                    />
                    <Button class="mt-1" store={vm.ui.$btn_create_remark}>
                      添加
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Match>
      </Switch>
    </ScrollView>
  );
}
