/**
 * @file JSON 内容预览
 */
import { Match, Show, Switch } from "solid-js";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { JSONContentPreview } from "@/components/preview-panels/json";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { toNumber } from "@/utils/primitive";
import { PasteEventProfileModel } from "@/biz/paste/paste_profile";
import { ImageContentPreview } from "@/components/preview-panels/image";
import { isCodeContent } from "@/biz/paste/utils";
import { CodeCard } from "@/components/code-card";

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
  const ui = {};

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
    <div class="relative w-full h-full">
      <Switch>
        <Match when={state().error}>
          <div>{state().error?.message}</div>
        </Match>
        <Match when={state().profile}>
          <div class="content w-full h-full">
            <Switch
              fallback={
                <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] p-4 rounded-md bg-w-bg-3">
                  <div class="break-all">{state().profile?.text!}</div>
                </div>
              }
            >
              <Match when={state().profile?.types.includes("image")}>
                <Show when={state().profile!.image_url}>
                  <ImageContentPreview url={state().profile!.image_url!} />
                </Show>
              </Match>
              <Match when={state().profile?.types.includes("JSON")}>
                <JSONContentPreview text={state().profile?.text!} />
              </Match>
              <Match when={isCodeContent(state().profile?.types)}>
                <CodeCard language={state().profile?.language} linenumber code={state().profile?.text!} />
              </Match>
            </Switch>
          </div>
        </Match>
      </Switch>
    </div>
  );
}
