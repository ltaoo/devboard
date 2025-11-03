/**
 * @file 支持的工具插件列表
 */
import { For, Show } from "solid-js";
import { Bird } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModelStore } from "@/hooks";
import { Input as InputPrimitive } from "@/packages/ui/input";
import { Popover, ScrollView } from "@/components/ui";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { InputCore, InputProps, PopoverCore, ScrollViewCore, SelectCore } from "@/domains/ui";
import { ListHighlightModel, OptionWithTopInList } from "@/domains/list-highlight";

export function CommandToolSelectModel(
  props: { app: ViewComponentProps["app"] } & {
    defaultValue: InputCore<any>["defaultValue"];
    onEnter?: (event: { code: string; value: string }) => void;
  }
) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    buildOptionWithHeightAndTop(v: Pick<OptionWithTopInList, "id" | "label">[]) {
      const options = v.map((opt, idx) => {
        const h = 6 + 24 + 6;
        return {
          id: opt.id,
          label: opt.label || `#${opt.id}`,
          height: h,
          top: idx * h,
        };
      });
      return options;
    },
    setOptions(v: Pick<OptionWithTopInList, "id" | "label">[]) {
      _options = methods.buildOptionWithHeightAndTop(v);
      _displayed_options = _options;
      _displayed_options = methods.filterDisplayedOptionsWithSelectedOptions();
      // console.log("[]with-input setOptions", _options.length, _displayed_options.length);
      ui.$list_highlight.methods.setOptions(_displayed_options);
    },
    selectMenuOption(idx: number) {
      console.log("[]with-input selectMenuOption", _displayed_options.length, idx);
      if (_displayed_options.length === 0) {
        return;
      }
      const selected_option = _displayed_options[idx];
      if (!selected_option) {
        return;
      }
      ui.$popover.hide();
      const matched = { ...selected_option };
      const existing = _selected_options.find((v) => v.id === matched.id);
      if (existing) {
        return;
      }
      _selected_options.push(matched);
      _displayed_options = methods.filterDisplayedOptionsWithSelectedOptions();
      console.log("[]with-input selectMenuOption", _displayed_options.length, idx);
      ui.$input.clear();
      methods.refresh();
      props.onEnter?.({
        code: "enter",
        value: ui.$input.value,
      });
    },
    filterDisplayedOptionsWithSelectedOptions() {
      const selected_option_map_by_id = _selected_options
        .map((opt) => {
          return {
            [opt.id]: opt,
          };
        })
        .reduce((a, b) => ({ ...a, ...b }), {});
      return [..._displayed_options].filter((opt) => {
        return !selected_option_map_by_id[opt.id];
      });
    },
    show(position: { x: number; y: number }) {
      // ui.$popover.toggle(position);
      // ui.$input.focus();
    },
    hide() {
      ui.$input.blur();
      ui.$popover.hide();
    },
    focus() {
      ui.$input.focus();
    },
    blur() {
      if (ui.$popover.visible) {
        ui.$popover.hide();
        return;
      }
      // console.log("[COMPONENT]with-input - before blur", ui.$input.state.focus);
      ui.$input.blur();
    },
    openSelect(opt: Partial<{ force: boolean }> = {}) {
      const with_keyboard = _state.isFocus && ui.$input.value === "";
      console.log("[COMPONENT]with-input - openSelect", ui.$input.value, opt.force, _state.isFocus);
      if (opt.force && ui.$input.value === "") {
        ui.$input.focus();
        ui.$popover.toggle({
          x: 80,
          y: 48,
        });
      } else if (with_keyboard) {
        ui.$input.focus();
        ui.$input.setValue("");
        ui.$popover.toggle({
          x: 80,
          y: 48,
        });
      }
    },
    moveToPrevOption(opt: { step: number }) {
      console.log("[COMPONENT]command-list - moveToPrevOption", opt);
      ui.$list_highlight.methods.moveToPrevOption(opt);
    },
    moveToNextOption(opt: { step: number }) {
      ui.$list_highlight.methods.moveToNextOption(opt);
    },
    handleEnterMenuOption(idx: number) {
      ui.$list_highlight.methods.setIdx(idx);
    },
    handleClickMenuOption(idx: number) {
      methods.selectMenuOption(idx);
      ui.$input.focus();
    },
    handleKeydownEnter() {
      if (ui.$popover.visible) {
        methods.selectMenuOption(ui.$list_highlight.state.idx);
        return;
      }
      props.onEnter?.({
        code: "enter",
        value: ui.$input.value,
      });
      return;
    },
    handleKeydownBackspace() {
      console.log("[COMPONENT]with-input - handleKeydownBackspace", ui.$input.value);
      if (ui.$input.value === "#") {
        ui.$input.setValue("");
        ui.$popover.hide();
        return;
      }
      if (ui.$input.value === "" && _selected_options.length !== 0) {
        _selected_options = _selected_options.slice(0, -1);
        _displayed_options = methods.filterDisplayedOptionsWithSelectedOptions();
        methods.refresh();
        props.onEnter?.({
          code: "backspace",
          value: ui.$input.value,
        });
        return;
      }
    },
  };
  const $view = new ScrollViewCore({});
  const ui = {
    $view,
    $input: new InputCore({
      defaultValue: props.defaultValue,
      ignoreEnterEvent: true,
      onChange(v) {
        console.log("[COMPONENT]command-list - onChange - ", ui.$input.value, v);
        if (!ui.$popover.visible) {
          return;
        }
        _displayed_options = _options.filter((opt) => {
          return opt.label.toLowerCase().includes(v);
        });
        _displayed_options = methods.filterDisplayedOptionsWithSelectedOptions();
        ui.$list_highlight.methods.setOptions(methods.buildOptionWithHeightAndTop(_displayed_options));
        ui.$list_highlight.methods.resetIdx();
        methods.refresh();
      },
    }),
    $popover: new PopoverCore({
      closeable: false,
    }),
    $list_highlight: ListHighlightModel({
      $view,
    }),
  };

  let _options: OptionWithTopInList[] = [];
  let _displayed_options: OptionWithTopInList[] = [];
  let _selected_options: OptionWithTopInList[] = [];
  let _state = {
    get options() {
      return _displayed_options.map((opt, idx) => {
        return {
          ...opt,
          selected: idx === ui.$list_highlight.state.idx,
        };
      });
    },
    get value() {
      return {
        keyword: ui.$input.value,
        tags: _selected_options,
      };
    },
    get tag() {
      return {
        list: _selected_options.slice(0, 3),
        exceedSize: Math.max(_selected_options.length - 3, 0),
      };
    },
    get isFocus() {
      return ui.$popover.state.visible;
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

  ui.$list_highlight.onStateChange(() => methods.refresh());
  ui.$input.onStateChange(() => methods.refresh());

  return {
    methods,
    ui,
    state: _state,
    get isFocus() {
      return _state.isFocus;
    },
    ready() {},
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
export type CommandToolSelectModel = ReturnType<typeof CommandToolSelectModel>;

export function CommandToolSelect(props: { store: CommandToolSelectModel }) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <>
      <Popover store={vm.ui.$popover} class="p-2 bg-w-fg-5">
        <div class="w-[320px]">
          <div class="flex items-center border-2 border-w-fg-3 bg-w-bg-3 rounded-md p-2 space-x-2">
            <InputPrimitive
              tabIndex={-1}
              classList={{
                "w-full bg-transparent": true,
                "outline-0 focus:outline-none focus:ring-0 focus:border-transparent": true,
              }}
              auto-capitalize="false"
              style={{
                "vertical-align": "bottom",
              }}
              store={vm.ui.$input}
            />
          </div>
          <ScrollView
            store={vm.ui.$view}
            classList={{
              "z-50 max-h-56 overflow-y-auto p-1 text-w-fg-0": true,
              "scroll--hidden": true,
            }}
          >
            <For
              each={state().options}
              fallback={
                <div class="h-24">
                  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div class="flex items-center flex-col items-center">
                      <Bird class="w-12 h-12 text-w-fg-1" />
                      <div class="mt-1 text-center text-w-fg-1 text-sm whitespace-nowrap">没有数据</div>
                    </div>
                  </div>
                </div>
              }
            >
              {(opt, idx) => {
                return (
                  <div
                    classList={{
                      "relative flex cursor-default select-none items-center rounded-xl py-1.5 px-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50":
                        true,
                      "bg-w-bg-3": opt.selected,
                    }}
                    onPointerEnter={() => {
                      vm.methods.handleEnterMenuOption(idx());
                    }}
                    onClick={() => {
                      vm.methods.handleClickMenuOption(idx());
                    }}
                  >
                    {opt.label}
                  </div>
                );
              }}
            </For>
          </ScrollView>
        </div>
      </Popover>
    </>
  );
}

export function buildOptionFromWaterfallCell($item: {
  state: {
    top?: number;
    height: number;
    payload: { id: string };
  };
}) {
  return {
    id: $item.state.payload.id,
    label: $item.state.payload.id,
    top: $item.state.top,
    height: $item.state.height,
  };
}
