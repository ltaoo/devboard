/**
 * @file 首页
 */
import { For, Match, Show, Switch } from "solid-js";
import { Copy, Earth, Eye, File, Link } from "lucide-solid";
import { Browser, Events } from "@wailsio/runtime";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, ListView, ScrollView, Skeleton } from "@/components/ui";
import { RelativeTime } from "@/components/relative_time";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { WaterfallView } from "@/components/ui/waterfall/waterfall";
import { Flex } from "@/components/flex/flex";

import { RequestCore, TheResponseOfRequestCore } from "@/domains/request";
import { base, Handler } from "@/domains/base";
import { ButtonCore, DialogCore, ScrollViewCore } from "@/domains/ui";
import { WaterfallModel } from "@/domains/ui/waterfall/waterfall";
import { WaterfallCellModel } from "@/domains/ui/waterfall/cell";
import { ListCore } from "@/domains/list";
import { TheItemTypeFromListCore } from "@/domains/list/typing";
import { openLocalFile, openFilePreview, saveFileTo } from "@/biz/fs/service";
import { isCodeContent } from "@/biz/paste/utils";
import { fetchPasteEventList, fetchPasteEventListProcess, openPasteEventPreviewWindow } from "@/biz/paste/service";

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
      list: new ListCore(
        new RequestCore(fetchPasteEventList, { process: fetchPasteEventListProcess, client: props.client })
      ),
      preview: new RequestCore(openPasteEventPreviewWindow, { client: props.client }),
    },
  };
  type SelectedFile = TheResponseOfRequestCore<typeof request.file.open_file>["files"][number];
  type PasteRecord = TheItemTypeFromListCore<typeof request.paste.list>;
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
    async handleClickPasteContent(v: PasteRecord) {
      if (v.type === "url") {
        Browser.OpenURL(v.text);
        return;
      }
      request.paste.preview.run({ id: v.id });
    },
    handleClickCopyBtn(v: PasteRecord) {
      props.app.copy(v.text);
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
      async onReachBottom() {
        console.log("[PAGE]home/index - onReachBottom");
        await request.paste.list.loadMore();
        ui.$view.finishLoadingMore();
      },
      onScroll(pos) {
        ui.$waterfall.methods.handleScroll({
          scrollTop: pos.scrollTop,
        });
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
        // const r = await request.paste.list.run({ page: 1 });
        // if (r.error) {
        //   return;
        // }
        // console.log(r.data);
      },
    }),
    $waterfall: WaterfallModel<PasteRecord>({ column: 1, gutter: 12, size: 10, buffer: 4 }),
  };

  let _selected_files = [] as SelectedFile[];
  const _state = {
    get waterfall() {
      return ui.$waterfall.state;
    },
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
  // request.paste.list.onStateChange(() => methods.refresh());
  request.paste.list.onDataSourceAdded((added) => {
    console.log("[PAGE]home/index - onDataSourceAdded", added);
    ui.$waterfall.methods.appendItems(added);
    console.log("[PAGE]home/index - handle added items", ui.$waterfall.state.columns.length);
    ui.$waterfall.state.columns.forEach((column) => {
      console.log("[PAGE]home/index - handle added items", column.items.length);
    });
    // methods.refresh();
  });
  ui.$waterfall.onStateChange(() => {
    methods.refresh();
  });
  Events.On("clipboard:update", () => {
    request.paste.list.reload();
  });

  return {
    request,
    methods,
    ui,
    state: _state,
    async ready() {
      const r = await request.paste.list.init();
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
        class="z-0 bg-w-bg-0"
        classList={{
          // "w-[375px] mx-auto": props.app.env.pc,
          "w-full": !props.app.env.pc,
        }}
      >
        {/* <div>
          <input />
        </div> */}
        <WaterfallView
          class="p-4"
          store={vm.ui.$waterfall}
          render={(payload) => {
            const v = payload;
            return (
              <div class="">
                <div
                  class="p-2 max-h-[120px] overflow-hidden rounded-md bg-w-bg-5"
                  onClick={() => {
                    vm.methods.handleClickPasteContent(v);
                  }}
                >
                  <Switch fallback={<div>{v.text}</div>}>
                    <Match when={v.type === "url"}>
                      <div class="w-full overflow-auto whitespace-nowrap scroll--hidden">
                        <div class="flex items-center gap-1 cursor-pointer">
                          <Link class="w-4 h-4" />
                          <div class="flex-1 w-0 underline">{v.text}</div>
                        </div>
                      </div>
                    </Match>
                    <Match when={v.type === "color"}>
                      <div class="flex items-center gap-1">
                        <div class="w-[16px] h-[16px]" style={{ "background-color": v.text }}></div>
                        <div>{v.text}</div>
                      </div>
                    </Match>
                    <Match when={v.type === "timestamp"}>
                      <div class="flex items-center gap-1">
                        <div>{v.origin_text}</div>
                        <div class="text-w-fg-1">{v.text}</div>
                      </div>
                    </Match>
                    <Match when={isCodeContent(v.type)}>
                      <div class="w-full overflow-auto cursor-pointer">
                        <pre>{v.text}</pre>
                      </div>
                    </Match>
                    <Match when={v.type === "code"}>
                      <div class="w-full overflow-auto">
                        <pre>{v.text}</pre>
                      </div>
                    </Match>
                    <Match when={v.type === "text"}>
                      <div>{v.text}</div>
                    </Match>
                    <Match when={v.type === "image" && v.image_url}>
                      <div class="cursor-pointer">
                        <img src={v.image_url!} />
                      </div>
                    </Match>
                  </Switch>
                </div>
                <Flex items="center" justify="between">
                  <div>
                    <div class="flex space-x-1 tags">
                      <div>#{v.type}</div>
                    </div>
                    <div class="text-sm text-w-fg-1">
                      <RelativeTime time={v.created_at}></RelativeTime>
                    </div>
                  </div>
                  <div class="operations flex justify-between">
                    <div class="flex items-center gap-1">
                      <div
                        class="p-2 rounded-md cursor-pointer hover:bg-w-bg-5"
                        onClick={() => {
                          vm.methods.handleClickCopyBtn(v);
                        }}
                      >
                        <Copy class="w-4 h-4" />
                      </div>
                      <Show when={["JSON"].includes(v.type)}>
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
                </Flex>
              </div>
            );
          }}
        />
      </ScrollView>
    </>
  );
};
