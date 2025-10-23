/**
 * @file 首页
 */
import { For, Match, Show, Switch } from "solid-js";
import { Bird, Check, ChevronUp, Copy, Download, Earth, Eye, File, Folder, Link, Trash } from "lucide-solid";
import { Browser, Dialogs, Events } from "@wailsio/runtime";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { HTMLCard } from "@/components/html-card";
import { Button, ListView, Popover, ScrollView, Skeleton, Textarea } from "@/components/ui";
import { RelativeTime } from "@/components/relative_time";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { WaterfallView } from "@/components/ui/waterfall/waterfall";
import { Flex } from "@/components/flex/flex";
import { buildOptionFromWaterfallCell, WithTagsInput, WithTagsInputModel } from "@/components/with-tags-input";
import { DynamicContent } from "@/components/dynamic-content";
import {
  DynamicContentWithClick,
  DynamicContentWithClickModel,
  ModelInList,
} from "@/components/dynamic-content/with-click";
import { CodeCard } from "@/components/code-card";

import { RequestCore, TheResponseOfRequestCore } from "@/domains/request";
import { base, Handler } from "@/domains/base";
import { ButtonCore, DialogCore, InputCore, PopoverCore, ScrollViewCore } from "@/domains/ui";
import { WaterfallModel } from "@/domains/ui/waterfall/waterfall";
import { WaterfallCellModel } from "@/domains/ui/waterfall/cell";
import { ListCore } from "@/domains/list";
import { TheItemTypeFromListCore } from "@/domains/list/typing";
import { BackToTopModel } from "@/domains/ui/back-to-top";
import { openLocalFile, openFilePreview, saveFileTo, highlightFileInFolder } from "@/biz/fs/service";
import { isCodeContent } from "@/biz/paste/utils";
import { fetchCategoryTree } from "@/biz/category/service";
import { downloadDouyinVideo } from "@/biz/douyin/service";
import {
  deletePasteEvent,
  fetchPasteEventList,
  fetchPasteEventListProcess,
  openPasteEventPreviewWindow,
  processPartialPasteEvent,
  writePasteEvent,
} from "@/biz/paste/service";
import { ShortcutModel } from "@/biz/shortcut/shortcut";
import { ListSelectModel } from "@/domains/list-select";
import { createRemark } from "@/biz/remark/service";
import { RefCore } from "@/domains/ui/cur";

const copy_buttons = [
  {
    content: <Copy class="w-4 h-4 text-w-fg-0" />,
  },
  {
    content: <Check class="w-4 h-4 text-green-500" />,
  },
];

function HomeIndexViewModel(props: ViewComponentProps) {
  const request = {
    file: {
      open_file: new RequestCore(openLocalFile, { client: props.client }),
      save_file: new RequestCore(saveFileTo, { client: props.client }),
      open_preview_window: new RequestCore(openFilePreview, { client: props.client }),
      highlight: new RequestCore(highlightFileInFolder, { client: props.client }),
    },
    paste: {
      list: new ListCore(
        new RequestCore(fetchPasteEventList, { process: fetchPasteEventListProcess, client: props.client }),
        {}
      ),
      delete: new RequestCore(deletePasteEvent, { client: props.client }),
      preview: new RequestCore(openPasteEventPreviewWindow, { client: props.client }),
      write: new RequestCore(writePasteEvent, { client: props.client }),
    },
    category: {
      tree: new RequestCore(fetchCategoryTree, { client: props.client }),
    },
    douyin: {
      download: new RequestCore(downloadDouyinVideo, { client: props.client }),
    },
  };
  type SelectedFile = TheResponseOfRequestCore<typeof request.file.open_file>["files"][number];
  type PasteRecord = TheItemTypeFromListCore<typeof request.paste.list>;
  const methods = {
    refresh() {
      bus.emit(EventNames.StateChange, { ..._state });
    },
    appendAddedPasteEvent(d: PasteRecord) {
      // const created_paste_event = d;
      // const vv = processPartialPasteEvent(created_paste_event);
      const vv = d;
      const height_of_new_paste_event = vv.height + ui.$waterfall.gutter;
      const added_height = height_of_new_paste_event;
      // const $column = ui.$waterfall.$columns[0];
      // const h = $column.state.height;
      // $column.methods.addHeight(added_height);
      // const h2 = ui.$waterfall.$columns[0].state.height;
      // const range = $column.range;
      // if (ui.$view.getScrollTop() === 0) {
      //   need_adjust_scroll_top = true;
      // }
      // console.log("[]before  need_adjust_scroll_top", ui.$view.getScrollTop());
      // console.log("[]before setScrollTop", ui.$view.getScrollTop(), added_height, h, h2, h2 - h);
      ui.$view.setScrollTop(ui.$view.getScrollTop() + added_height);
      // console.log("[]after setScrollTop", ui.$view.getScrollTop());
      const $created_items = ui.$waterfall.methods.unshiftItems([vv], { skipUpdateHeight: true });
      const $first = $created_items[0];
      if (!$first) {
        return;
      }
      ui.$list_select.methods.unshiftOption(buildOptionFromWaterfallCell($first));
      ui.$list_click.methods.set(
        d.id,
        DynamicContentWithClickModel({
          options: copy_buttons,
          onClick() {
            methods.copyPasteRecord(d);
          },
        })
      );
      $first.onHeightChange(([height, difference]) => {
        // console.log("[]before setScrollTop in onHeightChange", ui.$view.getScrollTop(), difference);
        ui.$view.addScrollTop(difference);
        // console.log("[]after setScrollTop in onHeightChange", ui.$view.getScrollTop());
        ui.$list_select.methods.updateOption(buildOptionFromWaterfallCell($first));
      });
      $first.onTopChange(() => {
        ui.$list_select.methods.updateOption(buildOptionFromWaterfallCell($first));
      });
    },
    prepareLoadRecord(data: PasteRecord) {
      const scroll_height = ui.$view.getScrollHeight();
      const client_height = ui.$view.getScrollClientHeight();
      // console.log(scroll_height, client_height);
      const has_scroll_bar = scroll_height > client_height;
      if (has_scroll_bar) {
        _added_records.push(data);
      }
      methods.appendAddedPasteEvent(data);
      if (!has_scroll_bar) {
        ui.$waterfall.methods.resetRange();
      }
      methods.refresh();
    },
    loadAddedRecords() {
      if (_added_records.length === 0) {
        return;
      }
      ui.$view.setScrollTop(0);
      _added_records = [];
      ui.$waterfall.methods.resetRange();
    },
    clickPasteWithIdx() {
      const idx = ui.$list_select.state.idx;
      const $cell = ui.$waterfall.$items[idx];
      const $click = ui.$list_click.methods.get($cell.state.payload.id);
      if ($click) {
        $click.methods.click();
      }
    },
    async copyPasteRecord(v: PasteRecord) {
      console.log("[PAGE]home/index - copyPasteRecord");
      const r = await request.paste.write.run({ id: v.id });
      if (r.error) {
        return;
      }
      // props.app.tip({
      //   text: ["已复制至粘贴板"],
      // });
    },
    async searchWithKeyword(event: { code: string }) {
      const body = {
        keyword: ui.$input_search.state.value.keyword,
        types: ui.$input_search.state.value.tags.map((tag) => tag.id),
      };
      const r = await request.paste.list.search(body);
      if (r.error) {
        return;
      }
      ui.$list_select.methods.resetIdx();
      methods.backToTop();
      // if (event.code === "enter") {
      //   ui.$input_search.methods.blur();
      // }
    },
    previewPasteContent(v: PasteRecord) {
      // if (v.types.includes("url")) {
      //   Browser.OpenURL(v.text);
      //   return;
      // }
      request.paste.preview.run({ id: v.id });
    },
    async deletePaste(v: PasteRecord) {
      // ui.$waterfall.methods.resetRange();
      // ui.$view.setScrollTop(0);
      // ui.$waterfall.methods.handleScroll({ scrollTop: 0 });
      request.paste.list.deleteItem((record) => {
        return record.id === v.id;
      });
      ui.$waterfall.methods.deleteCell((record) => {
        return record.id === v.id;
      });
      ui.$list_select.methods.deleteOptionById(v.id);
      if (request.paste.list.response.dataSource.length < 10 && !request.paste.list.response.noMore) {
        request.paste.list.loadMore();
      }
      const r = await request.paste.delete.run({ id: v.id });
      // if (r.error) {
      //   return;
      // }
    },
    backToTop() {
      ui.$view.setScrollTop(0);
      ui.$waterfall.methods.resetRange();
    },
    async handleClickFile(file: { mime_type: string; absolute_path: string }) {
      console.log("[]handleClickFile", file);
      const r = await request.file.highlight.run({ file_path: file.absolute_path });
      if (r.error) {
        return;
      }
    },
    async handleClickPasteContent(v: PasteRecord) {
      methods.previewPasteContent(v);
    },
    async handleClickOuterURL(event: { url: string }) {
      const r = await Dialogs.Question({
        Title: "Open URL",
        Message: "Are you sure open the url: " + event.url,
        Buttons: [
          {
            Label: "Cancel",
            IsCancel: true,
          },
          {
            Label: "Confirm",
            IsDefault: true,
          },
        ],
      });
      if (r !== "Confirm") {
        return;
      }
      Browser.OpenURL(event.url);
    },
    handleClickURL(url: string) {
      Browser.OpenURL(url);
      return;
    },
    async handleClickCopyBtn(v: PasteRecord) {
      methods.copyPasteRecord(v);
    },
    handleClickUpBtn() {
      methods.backToTop();
    },
    handleClickDownloadBtn(v: PasteRecord) {
      if (v.operations.includes("douyin_download")) {
        request.douyin.download.run({ content: v.text });
        return;
      }
      if (v.operations.includes("json_download")) {
        const time = parseInt(String(new Date().valueOf() / 1000));
        request.file.save_file.run({
          filename: `${time}.json`,
          content: v.text,
        });
        return;
      }
    },
    async handleClickTrashBtn(v: PasteRecord) {
      methods.deletePaste(v);
    },
    handleClickFileBtn(v: PasteRecord) {
      const time = parseInt(String(new Date().valueOf() / 1000));
      request.file.save_file.run({
        filename: `${time}.json`,
        content: v.text,
      });
    },
    handleHotkeyCopy(event: { code: string }) {
      if (ui.$input_search.isFocus) {
        if (event.code === "Enter") {
          ui.$input_search.methods.handleKeydownEnter();
          return;
        }
        return;
      }
      methods.clickPasteWithIdx();
    },
  };
  const $view = new ScrollViewCore({
    async onPullToRefresh() {
      // await methods.ready();
      // props.app.tip({
      //   text: ["刷新成功"],
      // });
      // ui.$view.finishPullToRefresh();
    },
    async onReachBottom() {
      // console.log("[PAGE]home/index - onReachBottom");
      await request.paste.list.loadMore();
      $view.finishLoadingMore();
    },
    onScroll(pos) {
      ui.$back_to_top.methods.handleScroll({ top: pos.scrollTop });
      if (pos.scrollTop < 20) {
        _added_records = [];
        methods.refresh();
      }
      ui.$waterfall.methods.handleScroll({
        scrollTop: pos.scrollTop,
      });
    },
  });
  const ui = {
    $view,
    $back_to_top: BackToTopModel({ clientHeight: props.app.screen.height }),
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
      app: props.app,
      defaultValue: "",
      async onEnter(event) {
        // await ui.$waterfall.methods.cleanColumns();
        methods.searchWithKeyword(event);
      },
    }),
    $waterfall: WaterfallModel<PasteRecord>({ column: 1, gutter: 12, size: 10, buffer: 4 }),
    $list_select: ListSelectModel({
      $view,
    }),
    $list_click: ModelInList<DynamicContentWithClickModel>({}),
    $shortcut: ShortcutModel({}),
  };

  let _selected_files = [] as SelectedFile[];
  let _added_records: PasteRecord[] = [];
  let _show_refresh_tip = false;
  const _state = {
    get waterfall() {
      return ui.$waterfall.state;
    },
    get paste_event() {
      return request.paste.list.response;
    },
    get show_refresh_tip() {
      return _added_records.length;
    },
    get show_back_to_top() {
      return ui.$back_to_top.state.showBackTop;
    },
    get selected_files() {
      return _selected_files;
    },
    get highlighted_idx() {
      return ui.$list_select.state.idx;
    },
  };
  enum EventNames {
    StateChange,
  }
  type TheTypesOfEvents = {
    [EventNames.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$shortcut.methods.register({
    "KeyK,ArrowUp"(event) {
      console.log("[]shortcut - KeyK", ui.$input_search.isFocus, event.code);
      if (ui.$input_search.isFocus) {
        if (ui.$input_search.isOpen && event.code === "ArrowUp") {
          ui.$input_search.methods.moveToPrevOption({ step: 1 });
          event.preventDefault();
          return;
        }
      }
      event.preventDefault();
      ui.$list_select.methods.moveToPrevOption({ step: 1 });
    },
    "ControlRight+KeyU"() {
      ui.$list_select.methods.moveToPrevOption({ step: 3, force: true });
    },
    "KeyJ,ArrowDown"(event) {
      console.log("[]shortcut - KeyJ", ui.$input_search.isFocus, ui.$input_search.isOpen, event.code);
      // console.log("[]shortcut - moveToNextOption");
      if (ui.$input_search.isFocus) {
        if (event.code === "ArrowDown") {
          if (ui.$input_search.isOpen) {
            event.preventDefault();
            ui.$input_search.methods.moveToNextOption({ step: 1 });
            return;
          }
          event.preventDefault();
          ui.$list_select.methods.moveToNextOption({ step: 1 });
          return;
        }
        return;
      }
      event.preventDefault();
      ui.$list_select.methods.moveToNextOption({ step: 1 });
    },
    "ControlRight+KeyD"() {
      ui.$list_select.methods.moveToNextOption({ step: 3, force: true });
    },
    KeyGKeyG() {
      ui.$list_select.methods.resetIdx();
      methods.backToTop();
    },
    KeyYKeyY(event) {
      methods.handleHotkeyCopy(event);
    },
    Space(event) {
      console.log("[PAGE]home/index - key Space", ui.$input_search.isFocus);
      if (ui.$input_search.isFocus) {
        return;
      }
      event.preventDefault();
      const idx = ui.$list_select.state.idx;
      const $cell = ui.$waterfall.$items[idx];
      methods.previewPasteContent($cell.state.payload);
    },
    Enter(event) {
      methods.handleHotkeyCopy(event);
    },
    Backspace() {
      if (ui.$input_search.isFocus) {
        ui.$input_search.methods.handleKeydownBackspace();
        return;
      }
    },
    "MetaLeft+KeyR"() {
      props.history.reload();
    },
    "MetaLeft+Backspace"() {
      // console.log("[PAGE]home/index - MetaLeft+Backspace");
      const idx = ui.$list_select.state.idx;
      const $cell = ui.$waterfall.$items[idx];
      methods.deletePaste($cell.state.payload);
    },
    "ShiftRight+Digit3"() {
      console.log("[PAGE]home/index - ShiftRight+Digit3");
      ui.$input_search.methods.openSelect({ force: true });
    },
    "MetaLeft+KeyF,ShiftLeft+KeyA,KeyO"(event) {
      if (ui.$input_search.isFocus) {
        return;
      }
      event.preventDefault();
      ui.$list_select.methods.resetIdx();
      methods.backToTop();
      ui.$input_search.methods.focus();
    },
    Escape() {
      ui.$input_search.methods.blur();
    },
  });

  request.paste.list.onStateChange(() => methods.refresh());
  request.paste.list.onDataSourceChange(({ dataSource, reason }) => {
    if (["init", "reload", "refresh", "search"].includes(reason)) {
      ui.$waterfall.methods.cleanColumns();
      ui.$waterfall.methods.appendItems(dataSource);
      ui.$list_select.methods.setOptions(ui.$waterfall.$items.map(buildOptionFromWaterfallCell));
      for (let i = 0; i < dataSource.length; i += 1) {
        const paste = dataSource[i];
        ui.$list_click.methods.set(
          paste.id,
          DynamicContentWithClickModel({
            options: copy_buttons,
            onClick() {
              methods.copyPasteRecord(paste);
            },
          })
        );
      }
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
    ui.$waterfall.methods.appendItems(added_items);
    ui.$list_select.methods.setOptions(ui.$waterfall.$items.map(buildOptionFromWaterfallCell));
    for (let i = 0; i < added_items.length; i += 1) {
      const paste = added_items[i];
      ui.$list_click.methods.set(
        paste.id,
        DynamicContentWithClickModel({
          options: copy_buttons,
          onClick() {
            methods.copyPasteRecord(paste);
          },
        })
      );
    }
  });
  ui.$waterfall.onCellUpdate(({ $item }) => {
    ui.$list_select.methods.updateOption(buildOptionFromWaterfallCell($item));
  });
  ui.$waterfall.onStateChange(() => methods.refresh());
  ui.$list_select.onStateChange(() => methods.refresh());
  ui.$back_to_top.onStateChange(() => methods.refresh());
  const unlisten = props.app.onKeydown((event) => {
    console.log("[PAGE]onKeydown", event.code);
    ui.$shortcut.methods.handleKeydown(event);
  });
  const unlisten2 = props.app.onKeyup((event) => {
    console.log("[PAGE]onKeyup", event.code);
    ui.$shortcut.methods.handleKeyup(event);
  });
  Events.On("clipboard:update", (event) => {
    const created_paste_event = event.data[0];
    if (!created_paste_event) {
      return;
    }
    const vv = processPartialPasteEvent(created_paste_event);
    methods.prepareLoadRecord(vv);
  });
  Events.On("m:refresh", (event) => {
    props.history.reload();
  });

  return {
    request,
    methods,
    ui,
    state: _state,
    async ready() {
      (async () => {
        const r = await request.category.tree.run();
        if (r.error) {
          return;
        }
        ui.$input_search.methods.setOptions(r.data);
      })();
      const r = await request.paste.list.init();
    },
    destroy() {
      unlisten();
      unlisten2();
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[EventNames.StateChange]>) {
      return bus.on(EventNames.StateChange, handler);
    },
  };
}

export const HomeIndexView = (props: ViewComponentProps) => {
  const [state, vm] = useViewModel(HomeIndexViewModel, [props]);

  return (
    <div class="relative w-full h-full" style="--custom-contextmenu: refresh; --custom-contextmenu-data: some-data">
      <Show when={!!state().show_refresh_tip}>
        <div class="z-[99] absolute top-4 left-1/2 -translate-x-1/2">
          <div class="py-2 px-4 bg-w-bg-3 rounded-full cursor-pointer" onClick={vm.methods.loadAddedRecords}>
            <div class="text-sm">{state().show_refresh_tip}条新内容</div>
          </div>
        </div>
      </Show>
      <ScrollView
        store={vm.ui.$view}
        class="z-0 relative bg-w-bg-0 scroll--hidden"
        classList={{
          // "w-[375px] mx-auto": props.app.env.pc,
          "w-full": !props.app.env.pc,
        }}
      >
        <div class="p-4 pb-0">
          <WithTagsInput store={vm.ui.$input_search} />
        </div>
        <WaterfallView
          class="relative p-4"
          store={vm.ui.$waterfall}
          list={vm.request.paste.list}
          // showFallback={state().paste_event.empty}
          fallback={
            <Show when={state().paste_event.empty}>
              <div class="flex flex-col items-center justify-center pt-12">
                <Bird class="text-w-fg-2 w-36 h-36" />
                <div class="mt-2 text-center text-w-fg-1">没有数据</div>
              </div>
            </Show>
          }
          render={(payload, idx) => {
            const v = payload;
            return (
              <div
                classList={{
                  "paste-event-card group relative p-2 rounded-md outline outline-2 outline-w-fg-3 select-text": true,
                  "bg-w-fg-5": state().highlighted_idx === idx,
                }}
                onClick={() => {
                  vm.ui.$list_select.methods.handleEnterMenuOption(idx);
                }}
              >
                <Show when={state().highlighted_idx === idx}>
                  <div class="absolute left-[-4px] top-1/2 -translate-y-1/2 w-[4px] h-[36px] rounded-md bg-green-500"></div>
                </Show>
                <div class="paste-event-card__content">
                  {/* <div class="absolute left-0 top-0">{state().highlighted_idx}</div> */}
                  {/* <div class="absolute left-2 top-2">{v.id}</div> */}
                  <div
                    classList={{
                      "relative min-h-[40px] max-h-[120px] overflow-hidden rounded-md": true,
                    }}
                  >
                    {/* <div
                    classList={{
                      "absolute left-0 top-0 h-full w-[4px] bg-green-300 hidden": true,
                      "group-hover:block": true,
                    }}
                  ></div> */}
                    {/* <div class="absolute right-0">{idx}</div> */}
                    <Switch fallback={<div class="p-2 text-w-fg-0 break-all">{v.text}</div>}>
                      <Match when={v.type === "file" && v.files}>
                        <div class="w-full p-2 overflow-auto whitespace-nowrap scroll--hidden">
                          <For each={v.files}>
                            {(f) => {
                              return (
                                <div>
                                  <div
                                    class="inline-flex items-center gap-1 cursor-pointer hover:underline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      vm.methods.handleClickFile(f);
                                    }}
                                  >
                                    <Switch>
                                      <Match when={f.mime_type === "folder"}>
                                        <Folder class="w-4 h-4 text-w-fg-1" />
                                      </Match>
                                      <Match when={f.mime_type !== "folder"}>
                                        <File class="w-4 h-4 text-w-fg-1" />
                                      </Match>
                                    </Switch>
                                    <div class="text-w-fg-0">{f.name}</div>
                                  </div>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      </Match>
                      <Match when={v.types.includes("url")}>
                        <div class="w-full p-2 overflow-auto whitespace-nowrap scroll--hidden">
                          <div
                            class="flex items-center gap-1 cursor-pointer"
                            onClick={() => {
                              vm.methods.handleClickURL(v.text);
                            }}
                          >
                            <Link class="w-4 h-4" />
                            <div class="flex-1 w-0 underline">{v.text}</div>
                          </div>
                        </div>
                      </Match>
                      <Match when={v.types.includes("color")}>
                        <div class="flex items-center gap-1 p-2">
                          <div class="w-[16px] h-[16px]" style={{ "background-color": v.text }}></div>
                          <div>{v.text}</div>
                        </div>
                      </Match>
                      <Match when={v.types.includes("time")}>
                        <div class="flex items-center gap-1 p-2">
                          <div>{v.origin_text}</div>
                          <div class="text-w-fg-1">{v.text}</div>
                        </div>
                      </Match>
                      <Match when={isCodeContent(v.types)}>
                        <div class="w-full overflow-auto">
                          <CodeCard id={v.id} language={v.language} code={v.text} />
                        </div>
                      </Match>
                      <Match when={v.type === "html"}>
                        <HTMLCard html={v.text} />
                      </Match>
                      <Match when={v.type === "image" && v.image_url}>
                        <div class="cursor-pointer">
                          <img src={v.image_url!} />
                        </div>
                      </Match>
                    </Switch>
                  </div>
                  <Flex class="mt-1" items="center" justify="between">
                    <div class="flex items-center space-x-1 tags">
                      <div class="px-2 bg-w-bg-5 rounded-full">
                        <div class="text-w-fg-0 text-sm">#{idx + 1}</div>
                      </div>
                      <For each={v.categories}>
                        {(c) => {
                          return (
                            <div class="px-2 bg-w-bg-5 rounded-full">
                              <div class="text-w-fg-0 text-sm">#{c.label}</div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                    <div class="flex items-center h-[32px]">
                      <Show
                        when={state().highlighted_idx === idx}
                        fallback={
                          <div class="time flex justify-between">
                            <div title={v.created_at_text}>
                              <RelativeTime class="text-sm text-w-fg-1" time={v.created_at}></RelativeTime>
                            </div>
                          </div>
                        }
                      >
                        <div class="operations flex justify-between">
                          <div class="flex items-center gap-1">
                            <Show when={v.operations.includes("douyin_download")}>
                              <div
                                class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  vm.methods.handleClickDownloadBtn(v);
                                }}
                              >
                                <Download class="w-4 h-4 text-w-fg-0" />
                              </div>
                            </Show>
                            <Show when={v.operations.includes("json_download")}>
                              <div
                                class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  vm.methods.handleClickDownloadBtn(v);
                                }}
                              >
                                <Download class="w-4 h-4 text-w-fg-0" />
                              </div>
                            </Show>
                            <div
                              class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                              onClick={(event) => {
                                event.stopPropagation();
                                vm.methods.handleClickTrashBtn(v);
                              }}
                            >
                              <Trash class="w-4 h-4 text-w-fg-0" />
                            </div>
                            <Show when={vm.ui.$list_click.methods.get(v.id)}>
                              <div
                                class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  vm.methods.handleClickCopyBtn(v);
                                }}
                              >
                                <DynamicContentWithClick store={vm.ui.$list_click.methods.get(v.id)!} />
                              </div>
                            </Show>
                            <Show when={["JSON"].includes(v.type)}>
                              <div
                                class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  vm.methods.handleClickFileBtn(v);
                                }}
                              >
                                <File class="w-4 h-4 text-w-fg-0" />
                              </div>
                            </Show>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Flex>
                </div>
              </div>
            );
          }}
        />
      </ScrollView>
      <Show when={!!state().show_back_to_top}>
        <div class="z-[99] absolute bottom-8 right-8">
          <div class="p-2 bg-w-bg-3 rounded-full cursor-pointer" onClick={vm.methods.handleClickUpBtn}>
            <ChevronUp class="w-8 h-8 text-w-fg-0" />
          </div>
        </div>
      </Show>
    </div>
  );
};
