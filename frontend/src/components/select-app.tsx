/**
 * @file 支持输入标签的输入框
 */
import { For, Show } from "solid-js";
import { Bird } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModelStore } from "@/hooks";
import { Input as InputPrimitive } from "@/packages/ui/input";
import { Popover, ScrollView } from "@/components/ui";
import { Input } from "@/components/ui/input";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { InputCore, InputProps, PopoverCore, ScrollViewCore, SelectCore } from "@/domains/ui";
import { ListHighlightModel, OptionWithTopInList } from "@/domains/list-highlight";
import { ShortcutModel } from "@/biz/shortcut/shortcut";
import { listenMultiEvent } from "@/domains/app/utils";

export function TagSelectModel(
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
          label: opt.label,
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
    updateInputRect(rect: { x: number; y: number; width: number; height: number }) {
      _input_rect = rect;
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
      //       ui.$popover.hide();
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
    registerKeyboardEvent() {
      _unlisten = listenMultiEvent([
        props.app.onKeydown((event) => {
          console.log("[COMPONENT]SelectApp - props.app.onKeydown", event.code);
          ui.$shortcut.methods.handleKeydown(event);
        }),
        props.app.onKeyup((event) => {
          ui.$shortcut.methods.handleKeyup(event);
        }),
      ]);
    },
    unregisterKeyboardEvent() {
      _unlisten();
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
        // console.log("[COMPONENT]with-input - onChange - ", ui.$input.value, v);
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
    $shortcut: ShortcutModel(),
  };

  let _options: OptionWithTopInList[] = [];
  let _displayed_options: OptionWithTopInList[] = [];
  let _selected_options: OptionWithTopInList[] = [];
  let _input_rect = { x: 0, y: 0, width: 0, height: 0 };
  let _unlisten = () => {};

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
      return _selected_options;
    },
    get tag() {
      return {
        list: _selected_options.slice(0, 3),
        exceedSize: Math.max(_selected_options.length - 3, 0),
      };
    },
    get isFocus() {
      return ui.$input.isFocus;
    },
    get isOpen() {
      return ui.$popover.state.visible;
    },
  };
  enum Events {
    Change,
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.Change]: typeof _state.value;
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  ui.$shortcut.methods.register({
    ArrowUp() {
      methods.moveToPrevOption({ step: 1 });
    },
    ArrowDown() {
      methods.moveToNextOption({ step: 1 });
    },
    Enter(event) {
      event.preventDefault();
      methods.handleKeydownEnter();
    },
    Escape() {
      if (ui.$popover.visible) {
        ui.$popover.hide();
      }
    },
  });

  ui.$list_highlight.onStateChange(() => methods.refresh());
  ui.$input.onStateChange(() => methods.refresh());
  ui.$input.onFocus(() => {
    ui.$popover.show({
      x: _input_rect.x,
      y: _input_rect.y + _input_rect.height + 8,
    });
    methods.registerKeyboardEvent();
  });
  ui.$input.onBlur(() => {
    ui.$popover.hide();
    methods.unregisterKeyboardEvent();
  });

  return {
    shape: "select" as const,
    methods,
    ui,
    state: _state,
    get defaultValue() {
      return props.defaultValue;
    },
    get value() {
      return _state.value;
    },
    get isFocus() {
      return _state.isFocus;
    },
    get isOpen() {
      return _state.isOpen;
    },
    setValue(v: unknown[]) {},
    ready() {},
    destroy() {
      _unlisten();
      bus.destroy();
    },
    onChange() {},
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}
export type TagSelectModel = ReturnType<typeof TagSelectModel>;

export function TagSelect(props: { store: TagSelectModel }) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <>
      <div class="flex items-center border-2 border-w-fg-3 bg-w-bg-3 rounded-md p-2 space-x-2">
        <div
          class="__a flex space-x-1"
          onAnimationEnd={(event) => {
            const { x, y, width, height } = event.target.getBoundingClientRect();
            vm.methods.updateInputRect({ x, y, width, height });
          }}
        >
          <For each={state().tag.list}>
            {(tag) => {
              return (
                <div class="bg-w-fg-3 rounded-md px-2">
                  <div class="text-w-fg-0 text-sm whitespace-nowrap">{tag.label}</div>
                </div>
              );
            }}
          </For>
          <Show when={state().tag.exceedSize}>
            <div class="bg-w-bg-5 rounded-md px-2">
              <div class="text-w-fg-0 text-sm whitespace-nowrap">+{state().tag.exceedSize}</div>
            </div>
          </Show>
        </div>
        <InputPrimitive
          tabIndex={-1}
          classList={{
            "w-full bg-transparent": true,
            "outline-0 focus:outline-none focus:ring-0 focus:border-transparent": true,
          }}
          auto-capitalize="false"
          spellcheck={false}
          style={{
            "vertical-align": "bottom",
          }}
          store={vm.ui.$input}
        />
      </div>
      <Popover store={vm.ui.$popover} class="p-2">
        <ScrollView
          store={vm.ui.$view}
          classList={{
            "z-50 min-w-[4rem] w-36 max-h-56 overflow-y-auto p-1 text-w-fg-0": true,
            "scroll--hidden": true,
          }}
        >
          <For
            each={state().options}
            fallback={
              <div class="h-24">
                <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div class="flex flex-col items-center">
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
      </Popover>
    </>
  );
}
