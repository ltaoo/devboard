/**
 * @file 首页
 */
import { For, Match, Show, Switch } from "solid-js";
import { Bird, Check, ChevronUp, Copy, Download, Earth, Eye, File, Folder, Link, Trash } from "lucide-solid";
import { Browser, Dialogs, Events } from "@wailsio/runtime";

import { ViewComponentProps } from "@/store/types";
import { buildOptionFromWaterfallCell, WithTagsInput, WithTagsInputModel } from "@/components/with-tags-input";
import {
  DynamicContentWithClick,
  DynamicContentWithClickModel,
  ModelInList,
} from "@/components/dynamic-content/with-click";
import { CommandToolSelect, CommandToolSelectModel } from "@/components/command-list";

import { RequestCore, TheResponseOfRequestCore } from "@/domains/request";
import { base, Handler } from "@/domains/base";
import { ButtonCore, DialogCore, InputCore, PopoverCore, ScrollViewCore } from "@/domains/ui";
import { WaterfallModel } from "@/domains/ui/waterfall/waterfall";
import { listenMultiEvent } from "@/domains/app/utils";
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
  downloadPasteContent,
  fetchPasteEventList,
  fetchPasteEventListProcess,
  openPasteEventPreviewWindow,
  processPartialPasteEvent,
  writePasteEvent,
} from "@/biz/paste/service";
import { ShortcutModel } from "@/biz/shortcut/shortcut";
import { ListHighlightModel } from "@/domains/list-highlight";
import { createRemark } from "@/biz/remark/service";
import { RefCore } from "@/domains/ui/cur";
import { SlateEditorModel } from "@/biz/slate/slate";
import { SlateView } from "@/components/slate/slate";
import { SlateDescendantType } from "@/biz/slate/types";

const copy_buttons = [
  {
    content: "copy",
  },
  {
    content: "check",
  },
];

export function HomeIndexViewModel(props: ViewComponentProps) {
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
      download: new RequestCore(downloadPasteContent, { client: props.client }),
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
      console.log("[PAGE]home/index - appendAddedPasteEvent", d.id);
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
      request.paste.list.unshiftItem(d);
      const $created_items = ui.$waterfall.methods.unshiftItems([vv], { skipUpdateHeight: true });
      const $first = $created_items[0];
      console.log("[PAGE]home/index before if (!$first", $created_items);
      if (!$first) {
        return;
      }
      ui.$list_highlight.methods.unshiftOption(buildOptionFromWaterfallCell($first));
      ui.$map_copy_btn.methods.set(d.id, () =>
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
        ui.$list_highlight.methods.updateOption(buildOptionFromWaterfallCell($first));
      });
      $first.onTopChange(() => {
        ui.$list_highlight.methods.updateOption(buildOptionFromWaterfallCell($first));
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
      ui.$list_highlight.methods.resetIdx();
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
      console.log("[PAGE]home/index - deletePaste", v.id);
      // ui.$waterfall.methods.resetRange();
      // ui.$view.setScrollTop(0);
      // ui.$waterfall.methods.handleScroll({ scrollTop: 0 });
      // 这个必须在 paste.list.deleteItem 前面
      ui.$waterfall.methods.deleteCell((record) => {
        return record.id === v.id;
      });
      ui.$list_highlight.methods.deleteOptionById(v.id);
      request.paste.list.deleteItem((record) => {
        return record.id === v.id;
      });
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
      console.log("[PAGE]handleClickDownloadBtn - ", v.operations);
      if (v.operations.includes("douyin") && v.text) {
        request.douyin.download.run({ content: v.text });
        return;
      }
      if (v.operations.includes("json") && v.text) {
        const time = parseInt(String(new Date().valueOf() / 1000));
        request.file.save_file.run({
          filename: `${time}.json`,
          content: v.text,
        });
        return;
      }
      if (v.operations.includes("image")) {
        request.paste.download.run({
          paste_event_id: v.id,
        });
        return;
      }
    },
    async handleClickTrashBtn(v: PasteRecord) {
      methods.deletePaste(v);
    },
    handleClickFileBtn(v: PasteRecord) {
      if (!v.text) {
        props.app.tip({
          text: ["异常数据"],
        });
        return;
      }
      const time = parseInt(String(new Date().valueOf() / 1000));
      request.file.save_file.run({
        filename: `${time}.json`,
        content: v.text,
      });
    },
    // handleHotkeyCopy(event: { code: string }) {
    //   if (ui.$input_search.isFocus) {
    //     if (event.code === "Enter") {
    //       ui.$input_search.methods.handleKeydownEnter();
    //       return;
    //     }
    //     return;
    //   }
    //   methods.clickPasteWithIdx();
    // },
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
      console.log("[PAGE]home/index - onReachBottom");
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
    $input_search: WithTagsInputModel({
      app: props.app,
      defaultValue: "",
      async onEnter(event) {
        // await ui.$waterfall.methods.cleanColumns();
        methods.searchWithKeyword(event);
      },
    }),
    $waterfall: WaterfallModel<PasteRecord>({ column: 1, gutter: 12, size: 10, buffer: 4 }),
    $list_highlight: ListHighlightModel({
      $view,
    }),
    $map_copy_btn: ModelInList<DynamicContentWithClickModel>({}),
    $shortcut: ShortcutModel({}),
    $commands: CommandToolSelectModel({ app: props.app, defaultValue: "" }),
  };

  let _selected_files = [] as SelectedFile[];
  let _added_records: PasteRecord[] = [];
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
      return ui.$list_highlight.state.idx;
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
      if (ui.$commands.isFocus) {
        if (event.code === "ArrowUp") {
          ui.$commands.methods.moveToPrevOption({ step: 1 });
          event.preventDefault();
          return;
        }
        return;
      }
      if (ui.$input_search.isFocus) {
        if (ui.$input_search.isOpen && event.code === "ArrowUp") {
          ui.$input_search.methods.moveToPrevOption({ step: 1 });
          event.preventDefault();
          return;
        }
        return;
      }
      event.preventDefault();
      ui.$list_highlight.methods.moveToPrevOption({ step: 1 });
    },
    "ControlRight+KeyU"() {
      if (ui.$commands.isFocus) {
        return;
      }
      if (ui.$input_search.isFocus) {
        ui.$input_search.methods.blur();
      }
      ui.$list_highlight.methods.moveToPrevOption({ step: 3, force: true });
    },
    "KeyJ,ArrowDown"(event) {
      // console.log("[]shortcut - KeyJ", ui.$input_search.isFocus, ui.$input_search.isOpen, event.code);
      console.log("[]shortcut - KeyJ");
      if (ui.$commands.isFocus) {
        if (event.code === "ArrowDown") {
          ui.$commands.methods.moveToNextOption({ step: 1 });
          event.preventDefault();
          return;
        }
        return;
      }
      if (ui.$input_search.isFocus) {
        if (event.code === "ArrowDown") {
          if (ui.$input_search.isOpen) {
            event.preventDefault();
            ui.$input_search.methods.moveToNextOption({ step: 1 });
            return;
          }
          event.preventDefault();
          ui.$list_highlight.methods.moveToNextOption({ step: 1 });
          return;
        }
        return;
      }
      event.preventDefault();
      ui.$list_highlight.methods.moveToNextOption({ step: 1 });
    },
    "ControlRight+KeyD"() {
      if (ui.$commands.isFocus) {
        return;
      }
      if (ui.$input_search.isFocus) {
        ui.$input_search.methods.blur();
      }
      ui.$list_highlight.methods.moveToNextOption({ step: 3, force: true });
    },
    "KeyGKeyG,Home"() {
      if (ui.$commands.isFocus) {
        return;
      }
      ui.$list_highlight.methods.resetIdx();
      methods.backToTop();
    },
    "KeyYKeyY,Enter"(event) {
      if (ui.$commands.isFocus) {
        return;
      }
      if (ui.$input_search.isFocus) {
        if (event.code === "Enter") {
          ui.$input_search.methods.handleKeydownEnter();
          return;
        }
        return;
      }
      const idx = ui.$list_highlight.state.idx;
      const $cell = ui.$waterfall.$items[idx];
      if (!$cell) {
        return;
      }
      const $click = ui.$map_copy_btn.methods.get($cell.state.payload.id);
      if (!$click) {
        return;
      }
      $click.methods.click();
    },
    Space(event) {
      // console.log("[PAGE]home/index - key Space", ui.$input_search.isFocus);
      if (ui.$commands.isFocus) {
        return;
      }
      if (ui.$input_search.isFocus) {
        return;
      }
      const idx = ui.$list_highlight.state.idx;
      const $cell = ui.$waterfall.$items[idx];
      if (!$cell) {
        return;
      }
      event.preventDefault();
      methods.previewPasteContent($cell.state.payload);
    },
    Backspace() {
      if (ui.$commands.isFocus) {
        return;
      }
      if (ui.$input_search.isFocus) {
        ui.$input_search.methods.handleKeydownBackspace();
        return;
      }
    },
    "MetaLeft+KeyR"() {
      props.history.reload();
    },
    "MetaLeft+Backspace,Delete"() {
      if (ui.$commands.isFocus) {
        return;
      }
      const opt = ui.$list_highlight.methods.getSelectedOption();
      console.log("[PAGE]home/index - MetaLeft+Backspace", opt.id);
      if (!opt) {
        props.app.tip({
          text: ["异常操作", "无法定位"],
        });
        return;
      }
      const record = request.paste.list.response.dataSource.find((v) => v.id === opt.id);
      if (!record) {
        props.app.tip({
          text: ["异常操作", "没有找到"],
        });
        return;
      }
      methods.deletePaste(record);
    },
    "MetaLeft+KeyK"() {
      if (ui.$commands.isFocus) {
        return;
      }
      const opt = ui.$list_highlight.methods.getSelectedOption();
      if (!opt) {
        return;
      }
      ui.$commands.methods.show({
        x: 72,
        y: (opt.top ?? 0) + opt.height + 58,
      });
    },
    "ShiftRight+Digit3"() {
      console.log("[PAGE]home/index - ShiftRight+Digit3");
      if (ui.$commands.isFocus) {
        return;
      }
      ui.$input_search.methods.openSelect({ force: true });
    },
    "MetaLeft+KeyF,ShiftLeft+KeyA,KeyO"(event) {
      if (ui.$commands.isFocus) {
        return;
      }
      if (ui.$input_search.isFocus) {
        return;
      }
      event.preventDefault();
      ui.$list_highlight.methods.resetIdx();
      methods.backToTop();
      ui.$input_search.methods.focus();
    },
    Escape() {
      if (ui.$commands.isFocus) {
        ui.$commands.methods.hide();
        return;
      }
      ui.$input_search.methods.blur();
    },
    EscapeEscape(event) {
      setTimeout(() => {
        Events.Emit({ name: "m:hide-main-window", data: null });
        // 100 是为了 keyup 能正确清除掉按下的 Esc
      }, 100);
    },
  });
  ui.$commands.methods.setOptions([
    {
      id: "json_format",
      label: "JSON 格式化",
    },
    {
      id: "cookie_parse",
      label: "Cookie 解析",
    },
  ]);

  request.paste.list.onStateChange(() => methods.refresh());
  request.paste.list.onDataSourceChange(({ dataSource, reason }) => {
    if (["delete", "unshift"].includes(reason)) {
      return;
    }
    if (["init", "reload", "refresh", "search"].includes(reason)) {
      ui.$waterfall.methods.cleanColumns();
      ui.$waterfall.methods.appendItems(dataSource);
      ui.$list_highlight.methods.setOptions(ui.$waterfall.$items.map(buildOptionFromWaterfallCell));
      for (let i = 0; i < dataSource.length; i += 1) {
        const paste = dataSource[i];
        ui.$map_copy_btn.methods.set(paste.id, () =>
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
    console.log("[PAGE]home/index - paste list dataSource change", added_items);
    ui.$waterfall.methods.appendItems(added_items);
    ui.$list_highlight.methods.setOptions(ui.$waterfall.$items.map(buildOptionFromWaterfallCell));
    for (let i = 0; i < added_items.length; i += 1) {
      const paste = added_items[i];
      ui.$map_copy_btn.methods.set(paste.id, () =>
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
    ui.$list_highlight.methods.updateOption(buildOptionFromWaterfallCell($item));
  });
  ui.$waterfall.onStateChange(() => methods.refresh());
  ui.$list_highlight.onStateChange(() => methods.refresh());
  ui.$back_to_top.onStateChange(() => methods.refresh());

  const unlisten = listenMultiEvent([
    props.app.onKeydown((event) => {
      // console.log("[PAGE]onKeydown", event.code);
      ui.$shortcut.methods.handleKeydown(event);
    }),
    props.app.onKeyup((event) => {
      // console.log("[PAGE]onKeyup", event.code);
      ui.$shortcut.methods.handleKeyup(event);
    }),
    props.app.onBlur(() => {
      ui.$shortcut.methods.reset();
    }),
    Events.On("clipboard:update", (event) => {
      const created_paste_event = event.data[0];
      if (!created_paste_event) {
        return;
      }
      const vv = processPartialPasteEvent(created_paste_event);
      methods.prepareLoadRecord(vv);
    }),
    Events.On("m:refresh", (event) => {
      props.history.reload();
    }),
  ]);

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
        ui.$input_search.methods.setOptions(
          r.data.map((v) => {
            return {
              id: v.id,
              label: `#${v.label}`,
            };
          })
        );
      })();
      const r = await request.paste.list.init();
    },
    destroy() {
      unlisten();
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[EventNames.StateChange]>) {
      return bus.on(EventNames.StateChange, handler);
    },
  };
}

export type HomeIndexViewModel = ReturnType<typeof HomeIndexViewModel>;
