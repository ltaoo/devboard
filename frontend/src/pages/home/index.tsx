/**
 * @file 首页
 */
import { For, Match, Show, Switch } from "solid-js";
import { Earth, Link } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, ScrollView, Skeleton } from "@/components/ui";
import { AspectRatio } from "@/components/ui/aspect-ratio";

import { RequestCore, TheResponseOfRequestCore } from "@/domains/request";
import { base, Handler } from "@/domains/base";
import { ButtonCore, DialogCore, ScrollViewCore } from "@/domains/ui";
import { openFileDialog, openFilePreview } from "@/biz/fs/service";
import { fetchPasteEventList, fetchPasteEventListProcess } from "@/biz/paste/service";

import { LocalVideo } from "./components/LazyVideo";
import { LocalImage } from "./components/LocalImage";
import { RelativeTime } from "@/components/relative_time";

function HomeIndexPageViewModel(props: ViewComponentProps) {
  const request = {
    file: {
      open_dialog: new RequestCore(openFileDialog, { client: props.client }),
      open_preview_window: new RequestCore(openFilePreview, { client: props.client }),
    },
    paste: {
      list: new RequestCore(fetchPasteEventList, { process: fetchPasteEventListProcess, client: props.client }),
    },
  };
  type SelectedFile = TheResponseOfRequestCore<typeof request.file.open_dialog>["files"][number];
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    async handleClickFile(file: SelectedFile) {
      console.log("[]handleClickVideo", file.name);
      const r = await request.file.open_preview_window.run({ mime_type: file.mine_type, filepath: file.full_path });
      if (r.error) {
        return;
      }
      console.log("[]handleClickVideo", r);
    },
  };
  const ui = {
    $view: new ScrollViewCore({
      async onPullToRefresh() {
        // await methods.ready();
        // props.app.tip({
        //   text: ["刷新成功"],
        // });
        // ui.$view.finishPullToRefresh();
      },
    }),
    $btn_show_file_dialog: new ButtonCore({
      async onClick() {
        // const r = await request.file.open_dialog.run();
        // console.log(r.data?.files);
        // if (r.error) {
        //   return;
        // }
        // if (r.data.cancel) {
        //   return;
        // }
        // for (let i = 0; i < r.data.files.length; i += 1) {
        //   const ff = r.data.files[i];
        //   const existing = _selected_files.find((v) => v.name === ff.name);
        //   if (!existing) {
        //     // _selected_files = [..._selected_files, ff];
        //     _selected_files.push(ff);
        //   }
        // }
        // methods.refresh();
        const r = await request.paste.list.run({ page: 1 });
        if (r.error) {
          return;
        }
        console.log(r.data);
      },
    }),
  };

  let _selected_files = [] as SelectedFile[];
  const _state = {
    get selected_files() {
      return _selected_files;
    },
    get paste_event() {
      return request.paste.list.response;
    },
  };
  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  // request.file.open_dialog.onStateChange(() => methods.refresh());
  request.paste.list.onStateChange(() => methods.refresh());

  return {
    methods,
    ui,
    state: _state,
    async ready() {
      const r = await request.paste.list.run({ page: 1 });
      if (r.error) {
        return;
      }
      console.log(r.data);
      // const r = await methods.ready();
      // if (r.error) {
      //   props.app.tip({
      //     text: [r.error.message],
      //   });
      //   return;
      // }
    },
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}

export const HomeIndexPage = (props: ViewComponentProps) => {
  const [state, vm] = useViewModel(HomeIndexPageViewModel, [props]);

  return (
    <>
      <ScrollView
        store={vm.ui.$view}
        class="z-0 bg-w-bg-0 p-4"
        classList={{
          // "w-[375px] mx-auto": props.app.env.pc,
          "w-full": !props.app.env.pc,
        }}
        // onDrop={(event) => {
        //   console.log(event);
        //   const {} = event.currentTarget.fil;
        // }}
      >
        <div class="space-y-2">
          <For each={state().paste_event?.list}>
            {(v) => {
              return (
                <div class="">
                  <div class="p-2 max-h-[120px] overflow-hidden rounded-md bg-w-bg-5">
                    <Switch fallback={<div>Unknown</div>}>
                      <Match when={v.type === "url"}>
                        <div class="flex items-center gap-1 w-full overflow-auto whitespace-nowrap scroll--hidden">
                          <Link class="w-4 h-4" />
                          <a class="flex-1 w-0" href={v.content.text}>
                            {v.content.text}
                          </a>
                        </div>
                      </Match>
                      <Match when={v.type === "json"}>
                        <div>{v.content.text}</div>
                      </Match>
                      <Match when={v.type === "html"}>
                        <div>{v.content.text}</div>
                      </Match>
                      <Match when={v.type === "code"}>
                        <div class="w-full overflow-auto">
                          <pre>{v.content.text}</pre>
                        </div>
                      </Match>
                      <Match when={v.type === "text"}>
                        <div>{v.content.text}</div>
                      </Match>
                    </Switch>
                  </div>
                  <div>
                    <div>{v.type}</div>
                  </div>
                  <div class="text-sm">
                    <RelativeTime time={v.created_at}></RelativeTime>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </ScrollView>
    </>
  );
};
