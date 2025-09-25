/**
 * @file 首页
 */
import { For, Match, Show, Switch } from "solid-js";
import { Bird, Check, Copy, Earth, Eye, File, Link } from "lucide-solid";
import { Browser, Events } from "@wailsio/runtime";

import { data } from "@mock/created_paste_event";
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
import {
  fetchPasteEventList,
  fetchPasteEventListProcess,
  openPasteEventPreviewWindow,
  processPartialPasteEvent,
} from "@/biz/paste/service";

import { LocalVideo } from "./components/LazyVideo";
import { LocalImage } from "./components/LocalImage";
import { WithTagsInput, WithTagsInputModel } from "@/components/with-tags-input";
import dayjs from "dayjs";
import { DynamicContent } from "@/components/dynamic-content";
import { DynamicContentWithClick } from "@/components/dynamic-content/with-click";

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
    $input_search: WithTagsInputModel({
      defaultValue: "",
      onEnter() {
        // await ui.$waterfall.methods.cleanColumns();
        request.paste.list.search({
          types: ui.$input_search.state.tags.map((tag) => tag.replace(/^#/, "")),
          keyword: ui.$input_search.state.value,
        });
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
  // request.paste.list.onStateChange((v) => {
  //   console.log("[PAGE]home/index - onStateChange", v);
  //   for (let i = 0; i < v.dataSource.length; i += 1) {
  //     const record = v.dataSource[i];
  //     ui.$waterfall.methods.appendItems(added);
  //     console.log("[PAGE]home/index - handle added items", ui.$waterfall.state.columns.length);
  //   }
  // });
  request.paste.list.onDataSourceChange(({ dataSource, reason }) => {
    // const isNewRequest = dataSource.length !== 0 && dataSource.length <= request.paste.list.response.dataSource.length;
    // console.log("[]onDataSourceChange", dataSource.length, request.paste.list.response.dataSource.length);
    if (["init", "reload", "refresh", "search"].includes(reason)) {
      ui.$waterfall.methods.cleanColumns();
      ui.$waterfall.methods.appendItems(dataSource);
      return;
    }
    const existing_ids = ui.$waterfall.$items.map((v) => v.state.payload.id);
    const added_items: PasteRecord[] = [];
    for (let i = 0; i < dataSource.length; i += 1) {
      const dd = dataSource[i];
      // const is_existing = existing_data_source.includes(dd.id);
      const is_existing = existing_ids.includes(dd.id);
      if (!is_existing) {
        added_items.push(dd);
      }
    }
    console.log(
      "[]onDataSourceChange - before appendItems",
      existing_ids,
      dataSource.map((v) => v.id),
      added_items
    );
    ui.$waterfall.methods.appendItems(added_items);
  });
  ui.$waterfall.onStateChange(() => {
    methods.refresh();
  });
  // setTimeout(() => {
  //   const created_paste_event = data;
  //   const vv = processPartialPasteEvent(created_paste_event);
  //   const height_of_new_paste_event = vv.height + ui.$waterfall.gutter;
  //   console.log(vv.height, ui.$waterfall.gutter);
  //   const changed_height = height_of_new_paste_event;
  //   ui.$waterfall.$columns[0].methods.addHeight(changed_height);
  //   ui.$view.setScrollTop(changed_height);
  //   ui.$waterfall.methods.unshiftItems([vv]);
  // }, 2000);
  Events.On("clipboard:update", (event) => {
    const created_paste_event = event.data[0];
    if (!created_paste_event) {
      return;
    }
    const vv = processPartialPasteEvent(created_paste_event);
    const height_of_new_paste_event = vv.height + ui.$waterfall.gutter;
    console.log(vv.height, ui.$waterfall.gutter);
    const changed_height = height_of_new_paste_event;
    ui.$waterfall.$columns[0].methods.addHeight(changed_height);
    ui.$view.setScrollTop(changed_height);
    ui.$waterfall.methods.unshiftItems([vv]);
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
        class="z-0 relative bg-w-bg-0"
        classList={{
          // "w-[375px] mx-auto": props.app.env.pc,
          "w-full": !props.app.env.pc,
        }}
      >
        {/* <div class="p-4 pb-0">
          <WithTagsInput store={vm.ui.$input_search} />
        </div> */}
        <WaterfallView
          class="p-4"
          store={vm.ui.$waterfall}
          fallback={
            <div class="flex flex-col items-center justify-center pt-12">
              <Bird class="text-w-fg-2 w-36 h-36" />
              <div class="mt-2 text-center text-w-fg-1">没有数据</div>
            </div>
          }
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
                        <DynamicContentWithClick
                          options={[
                            {
                              content: <Copy class="w-4 h-4" />,
                            },
                            {
                              content: <Check class="w-4 h-4 text-green-500" />,
                            },
                          ]}
                        />
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
