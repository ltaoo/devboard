/**
 * @file 支持输入标签的输入框
 */
import { For } from "solid-js";
import { Bird } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModelStore } from "@/hooks";
import { Input as InputPrimitive } from "@/packages/ui/input";
import { Popover, ScrollView } from "@/components/ui";
import { Input } from "@/components/ui/input";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { InputCore, InputProps, PopoverCore, ScrollViewCore, SelectCore } from "@/domains/ui";
import { ListSelectModel, OptionWithTopInList } from "@/domains/list-select";
import { ShortcutModel } from "@/biz/shortcut/shortcut";

export function WithTagsInputModel(
  props: { app: ViewComponentProps["app"] } & {
    defaultValue: InputCore<any>["defaultValue"];
    onEnter?: (event: { code: string; value: string }) => void;
  }
) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setOptions(v: Pick<OptionWithTopInList, "id">[]) {
      const options = v.map((opt, idx) => {
        const h = 6 + 24 + 6;
        return {
          id: opt.id,
          label: opt.id,
          height: h,
          top: idx * h,
        };
      });
      _displayed_options = options;
      _options = options;
      ui.$list_select.methods.setOptions(_displayed_options);
    },
    selectMenuOption(idx: number) {
      ui.$input_select.hide();
      const matched = { ..._displayed_options[idx] };
      const existing = _selected_options.find((v) => v.id === matched.id);
      if (existing) {
        return;
      }
      _selected_options.push(matched);
      _displayed_options = [..._options];
      ui.$input.clear();
      methods.refresh();
      props.onEnter?.({
        code: "enter",
        value: ui.$input.value,
      });
    },
    focus() {
      ui.$input.focus();
    },
    blur() {
      if (ui.$input_select.visible) {
        ui.$input_select.hide();
        return;
      }
      // console.log("[COMPONENT]with-input - before blur", ui.$input.state.focus);
      ui.$input.blur();
    },
    openSelect(opt: Partial<{ force: boolean }> = {}) {
      const with_keyboard = _state.isFocus && ui.$input.value === "";
      // console.log("[COMPONENT]with-input - openSelect", _state.isFocus, ui.$input.value, opt.force, with_keyboard);
      if (opt.force && !_state.isFocus) {
        ui.$input.focus();
        ui.$input_select.toggle({
          x: 80,
          y: 48,
        });
      }
      if (with_keyboard) {
        ui.$input.focus();
        ui.$input_select.toggle({
          x: 80,
          y: 48,
        });
      }
    },
    moveToPrevOption(opt: { step: number }) {
      ui.$list_select.methods.moveToPrevOption(opt);
    },
    moveToNextOption(opt: { step: number }) {
      ui.$list_select.methods.moveToNextOption(opt);
    },
    handleEnterMenuOption(idx: number) {
      ui.$list_select.methods.setIdx(idx);
    },
    handleClickMenuOption(idx: number) {
      methods.selectMenuOption(idx);
      ui.$input.focus();
    },
  };
  const $view = new ScrollViewCore({});
  const ui = {
    $view,
    $input: new InputCore({
      defaultValue: props.defaultValue,
      ignoreEnterEvent: true,
      // onFocus() {
      //   console.log("[COMPONENT]with-input - onFocus");
      //   _focus = true;
      // },
      // onBlur() {
      //   console.log("[COMPONENT]with-input - onBlur");
      //   _focus = false;
      // },
      onChange(v) {
        console.log("[]onChange - ", ui.$input.value, v);
        if (v === "#") {
          return;
        }
        // if (ui.$input.value === "#" && v === "#") {
        //   return;
        // }
        if (ui.$input_select.visible) {
          _displayed_options = _options.filter((opt) => {
            return opt.label.toLowerCase().includes(v);
          });
          ui.$list_select.methods.resetIdx();
          methods.refresh();
        }
        // const last_char = v[v.length - 1];
        // if (last_char !== " ") {
        //   return;
        // }
        // const is_tag = v.match(/^#[a-zA-Z0-9-]{1,} /);
        // if (!is_tag) {
        //   return;
        // }
        // _options = [..._options, v.trim()];
        // methods.refresh();
        // ui.$input.setValue("");
      },
      onKeyDown(event) {
        // console.log("[COMPONENT]WithTagsInput - on keydown", ui.$input.value, event.code);
        if (event.code === "Enter") {
          if (ui.$input_select.visible) {
            methods.selectMenuOption(ui.$list_select.state.idx);
            return;
          }
          props.onEnter?.({
            code: "enter",
            value: ui.$input.value,
          });
          return;
        }
        if (ui.$input_select.visible) {
          if (event.code === "ArrowUp" || event.code === "ArrowDown") {
            return;
          }
        }
        if (ui.$input.value === "" && event.code === "Digit3") {
          event.preventDefault();
          // methods.openSelect();
          return;
        }
        if (event.code === "Backspace") {
          if (ui.$input.value === "" && _selected_options.length !== 0) {
            _selected_options = _selected_options.slice(0, -1);
            _displayed_options = _options;
            methods.refresh();
            props.onEnter?.({
              code: "backspace",
              value: ui.$input.value,
            });
            return;
          }
        }
      },
    }),
    $input_select: new PopoverCore({
      closeable: false,
    }),
    $list_select: ListSelectModel({
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
          selected: idx === ui.$list_select.state.idx,
        };
      });
    },
    get value() {
      return {
        keyword: ui.$input.value,
        tags: _selected_options,
      };
    },
    get isFocus() {
      return ui.$input.isFocus;
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

  ui.$list_select.onStateChange(() => methods.refresh());
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

export type WithTagsInputModel = ReturnType<typeof WithTagsInputModel>;

export function WithTagsInput(props: { store: WithTagsInputModel }) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <>
      <div class="flex items-center border border-w-fg-3 rounded-md p-2 space-x-2">
        <div class="flex space-x-1">
          <For each={state().value.tags}>
            {(tag) => {
              return (
                <div class="bg-w-bg-5 rounded-md px-2">
                  <div class="text-w-fg-0 text-sm whitespace-nowrap">{tag.label}</div>
                </div>
              );
            }}
          </For>
        </div>
        {/* <Input store={vm.ui.$input} /> */}
        <InputPrimitive
          // class={cn(
          //   "flex items-center h-10 w-full rounded-xl leading-none border-2 border-w-fg-3 py-2 px-3 text-w-fg-0 bg-transparent",
          //   "focus:outline-none focus:ring-w-bg-3",
          //   "disabled:cursor-not-allowed disabled:opacity-50",
          //   "placeholder:text-w-fg-2",
          //   props.prefix ? "pl-8" : "",
          //   props.class
          // )}
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
      {/* <Select store={vm.ui.$input_select} /> */}
      <Popover store={vm.ui.$input_select} class="p-2">
        <ScrollView
          store={vm.ui.$view}
          classList={{
            "z-50 min-w-[4rem] w-36 max-h-56 overflow-y-auto rounded-xl p-1 text-w-fg-0 shadow-md": true,
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
                    "bg-w-bg-5": opt.selected,
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
