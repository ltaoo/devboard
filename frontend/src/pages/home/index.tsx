/**
 * @file 首页
 */
import { For, Match, Show, Switch } from "solid-js";
import { Earth, Eye, File, Link } from "lucide-solid";
import { Browser, Events } from "@wailsio/runtime";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, ScrollView, Skeleton } from "@/components/ui";
import { RelativeTime } from "@/components/relative_time";
import { AspectRatio } from "@/components/ui/aspect-ratio";

import { RequestCore, TheResponseOfRequestCore } from "@/domains/request";
import { base, Handler } from "@/domains/base";
import { ButtonCore, DialogCore, ScrollViewCore } from "@/domains/ui";
import { openLocalFile, openFilePreview, saveFileTo } from "@/biz/fs/service";
import { fetchPasteEventList, fetchPasteEventListProcess, openPreviewWindow } from "@/biz/paste/service";

import { LocalVideo } from "./components/LazyVideo";
import { LocalImage } from "./components/LocalImage";

function HomeIndexPageViewModel(props: ViewComponentProps) {
  const request = {
    file: {
      open_file: new RequestCore(openLocalFile, { client: props.client }),
      save_file: new RequestCore(saveFileTo, { client: props.client }),
      open_preview_window: new RequestCore(openFilePreview, { client: props.client }),
    },
    paste: {
      list: new RequestCore(fetchPasteEventList, { process: fetchPasteEventListProcess, client: props.client }),
      preview: new RequestCore(openPreviewWindow, { client: props.client }),
    },
  };
  type SelectedFile = TheResponseOfRequestCore<typeof request.file.open_file>["files"][number];
  type PasteRecord = TheResponseOfRequestCore<typeof request.paste.list>["list"][number];
  const methods = {
    refresh() {
      bus.emit(EventNames.StateChange, { ..._state });
    },
    async handleClickFile(file: SelectedFile) {
      console.log("[]handleClickVideo", file.name);
      const r = await request.file.open_preview_window.run({ mime_type: file.mine_type, filepath: file.full_path });
      if (r.error) {
        return;
      }
      console.log("[]handleClickVideo", r);
    },
    handleClickEyeBtn(v: PasteRecord) {
      request.paste.preview.run({ id: v.id });
    },
    handleClickFileBtn(v: PasteRecord) {
      const time = parseInt(String(new Date().valueOf() / 1000));
      request.file.save_file.run({
        filename: `${time}.json`,
        content: v.content.text,
      });
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
  enum EventNames {
    StateChange,
  }
  type TheTypesOfEvents = {
    [EventNames.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  // request.file.open_dialog.onStateChange(() => methods.refresh());
  request.paste.list.onStateChange(() => methods.refresh());
  Events.On("common:WindowFilesDropped", (event) => {
    const files = event.data.files;
    console.log(files);
    // files.forEach((file) => {
    //   console.log("File dropped:", file);
    //   // Process the dropped files
    //   handleFileUpload(file);
    // });
  });
  Events.On("clipboard:update", () => {
    request.paste.list.reload();
  });

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
    onStateChange(handler: Handler<TheTypesOfEvents[EventNames.StateChange]>) {
      return bus.on(EventNames.StateChange, handler);
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
                    <Switch fallback={<div>{v.content.text}</div>}>
                      <Match when={v.type === "url"}>
                        <div class="w-full overflow-auto whitespace-nowrap scroll--hidden">
                          <div
                            class="flex items-center gap-1 cursor-pointer"
                            onClick={() => {
                              Browser.OpenURL(v.content.text);
                            }}
                          >
                            <Link class="w-4 h-4" />
                            <div class="flex-1 w-0">{v.content.text}</div>
                          </div>
                        </div>
                      </Match>
                      <Match when={v.type === "color"}>
                        <div class="flex items-center gap-1">
                          <div class="w-[16px] h-[16px]" style={{ "background-color": v.content.text }}></div>
                          <div>{v.content.text}</div>
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
                  <div class="flex justify-between">
                    <div class="text-sm">
                      <RelativeTime time={v.created_at}></RelativeTime>
                    </div>
                    <div class="flex items-center gap-1">
                      <Show when={["json"].includes(v.type)}>
                        <div
                          class="p-2 rounded-md cursor-pointer hover:bg-w-bg-5"
                          onClick={() => {
                            vm.methods.handleClickEyeBtn(v);
                          }}
                        >
                          <Eye class="w-4 h-4" />
                        </div>
                        <div
                          class="p-2 rounded-md cursor-pointer hover:bg-w-bg-5"
                          onClick={() => {
                            vm.methods.handleClickFileBtn(v);
                          }}
                        >
                          <File class="w-4 h-4" />
                        </div>
                      </Show>
                    </div>
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
