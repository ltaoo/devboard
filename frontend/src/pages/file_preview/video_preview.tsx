/**
 * @file 视频文件播放
 */
import { createSignal, onMount, Show } from "solid-js";

import { FileService } from "~/index";

import { ViewComponentProps } from "@/store/types";
import { Video } from "@/components/ui";
import { useViewModel } from "@/hooks";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { VideoPlayerCore } from "@/domains/video_player";
import { RequestCore } from "@/domains/request";
import { request_factory } from "@/domains/request/utils";
import { Result } from "@/domains/result";

import { fetch_file_url } from "./service";

function VideoFilePreviewModel(props: ViewComponentProps) {
  const request = {
    video: {
      profile: new RequestCore(fetch_file_url, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $player: new VideoPlayerCore({ app: props.app }),
  };

  let _loading = true;
  let _error: BizError | null = null;
  let _url = "";
  let _state = {
    get loading() {
      return _loading;
    },
    get error() {
      return _error;
    },
    get url() {
      return _url;
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

  ui.$player.onStateChange(() => methods.refresh());
  ui.$player.onCanPlay(() => {
    ui.$player.play();
  });
  ui.$player.onEnd(() => {
    ui.$player.play();
  });

  return {
    methods,
    ui,
    state: _state,
    async ready() {
      if (!props.view.query.f) {
        _error = new BizError(["Missing the `f` parameter"]);
        methods.refresh();
        return;
      }
      const r = await request.video.profile.run(props.view.query.f);
      if (r.error) {
        console.log("[]profile.run failed", r.error.message);
        _error = r.error;
        methods.refresh();
        return;
      }
      _url = r.data;
      console.log("[]before ui.$player.load(_url", _url);
      ui.$player.load(_url);
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

export function VideoFilePreviewView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(VideoFilePreviewModel, [props]);

  return (
    <div>
      <Show when={state().error}>
        <div>{state().error?.message}</div>
      </Show>
      <Video store={vm.ui.$player} />
    </div>
  );
}
