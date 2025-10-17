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
import { ScrollView } from "@/components/ui";
import { ScrollViewCore } from "@/domains/ui";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { PasteEventProfileModel } from "@/biz/paste/paste_profile";
import { isCodeContent } from "@/biz/paste/utils";
import { toNumber } from "@/utils/primitive";
import { PasteContentImage, PasteContentType } from "@/biz/paste/service";

function PreviewPasteEventModel(props: ViewComponentProps) {
  const $profile = PasteEventProfileModel(props);

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

  $profile.onStateChange(() => methods.refresh());

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
            <div class="content__preview relative flex-1 h-full">
              <Switch
                fallback={
                  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] p-4 rounded-md bg-w-bg-3">
                    <div class="break-all">{state().profile?.text!}</div>
                  </div>
                }
              >
                <Match when={state().profile?.type === "html"}>
                  <div class="overflow-y-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[80vh] p-4 rounded-md bg-w-bg-3">
                    <HTMLCard html={state().profile!.text!} />
                  </div>
                </Match>
                <Match when={state().profile?.type === "image"}>
                  <Show when={state().profile!.image_url}>
                    <ImageContentPreview url={state().profile!.image_url!} />
                  </Show>
                </Match>
                <Match when={state().profile?.type === "file"}>
                  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] p-4 rounded-md bg-w-bg-3">
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
                <Match when={state().profile?.types.includes("JSON")}>
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
            <div class="content_profile w-[280px] h-full p-4 bg-w-bg-3">
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
                          <div>宽高</div>
                          <div class="flex items-center">
                            <div>{(state().profile?.details?.data as PasteContentImage).width}</div>
                            <div>x</div>
                            <div>{(state().profile?.details?.data as PasteContentImage).height}</div>
                          </div>
                        </div>
                        <div class="">
                          <div>大小</div>
                          <div>{(state().profile?.details?.data as PasteContentImage).size_for_humans}</div>
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
                <div class="fields mt-4">
                  <div class="field text-w-fg-0">
                    <div>创建时间</div>
                    <div class="paste_created_at">{state().profile?.created_at_text}</div>
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
