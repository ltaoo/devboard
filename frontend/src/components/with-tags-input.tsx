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
import { ShortcutModel } from "@/biz/shortcut/shortcut";

export function SelectWithKeyboardModel(props: {
  $view: ScrollViewCore;
  num?: number;
  app: ViewComponentProps["app"];
}) {
  type OptionInMenu = { id: string; label: string; height: number; top?: number };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setOptions(list: OptionInMenu[]) {
      // console.log("[COMPONENT]with-tags-input - setOptions", v[0]);
      _options = list;
      _displayed_options = _options;
    },
    appendOptions(list: OptionInMenu[]) {
      // console.log("[COMPONENT]with-tags-input - setOptions", v[0]);
      _options = [..._options, ...list];
      _displayed_options = _options;
    },
    unshiftOption(v: OptionInMenu) {
      // console.log("[COMPONENT]with-tags-input - unshiftOption", v);
      _options.unshift(v);
      _opt_idx += 1;
    },
    updateOption(v: OptionInMenu) {
      const idx = _options.findIndex((opt) => opt.id === v.id);
      // console.log("[COMPONENT]with-tags-input - updateOption", v.id, v.top, idx);
      if (idx === -1) {
        // console.error("[COMPONENT]with-tags-input - not found matched opt");
        return;
      }
      _options[idx] = v;
      methods.refresh();
    },
    selectMenuOption(idx: number) {
      // ui.$input_select.hide();
      // const matched = { ..._displayed_options[idx] };
      // const existing = _selected_options.find((v) => v.id === matched.id);
      // if (existing) {
      //   return;
      // }
      // _selected_options.push(matched);
      // _displayed_options = [..._options];
      // ui.$input.clear();
      // methods.refresh();
    },
    moveToNextOption(step = 1) {
      // console.log("[COMPONENT]with-tags-input - moveToNextOption", _opt_idx, _options.length);
      _opt_idx += step;
      if (_opt_idx > _options.length - 1) {
        _opt_idx = _options.length - 1;
      }
      const scroll_top = ui.$view.getScrollTop();
      const client_height = ui.$view.getScrollClientHeight();
      const target_option = _options[_opt_idx];
      // console.log(
      //   "[COMPONENT]with-tag - moveToNext calc need scroll the container",
      //   _opt_idx,
      //   client_height,
      //   scroll_top,
      //   target_option
      // );
      if (target_option && target_option.top !== undefined) {
        const cur_option_in_up_area = target_option.top + target_option.height - scroll_top < 0;
        const cur_option_in_bottom_area = Math.abs(target_option.top - scroll_top) > client_height;
        if (cur_option_in_up_area || cur_option_in_bottom_area) {
          const closest_opt_idx = _options.findIndex((opt) => {
            return opt.top && opt.top >= scroll_top;
          });
          if (closest_opt_idx !== -1) {
            // const closest_opt = _options[closest_opt_idx];
            // console.log(closest_opt);
            // console.log("[COMPONENT]with-tag - moveToNext direct to option", closest_opt_idx);
            _opt_idx = closest_opt_idx;
          }
        } else if (target_option.top > client_height / 2 + scroll_top) {
          // ui.$view.scrollTo({ top: cur_option.top - client_height / 2 });
          ui.$view.setScrollTop(target_option.top - client_height / 2);
        }
      }
      // const menu_height = 24 + 6 + 6;
      // if (_opt_idx * menu_height > scroll_top + (default_displayed_menu_count - 1) * menu_height) {
      //   ui.$view.setScrollTop(scroll_top + menu_height);
      // }
      methods.refresh();
    },
    moveToPrevOption(step = 1) {
      // console.log("[COMPONENT]with-tags-input - moveToPrevOption", _opt_idx, _options.length);
      const cur_option = _options[_opt_idx];
      _opt_idx -= step;
      if (_opt_idx < 0) {
        _opt_idx = 0;
      }
      const target_option = _options[_opt_idx];
      const scroll_top = ui.$view.getScrollTop();
      const client_height = ui.$view.getScrollClientHeight();
      // console.log(
      //   "[COMPONENT]with-tags-input - calc need scroll the container",
      //   _opt_idx,
      //   client_height,
      //   scroll_top,
      //   cur_option.top,
      //   target_option
      // );
      if (target_option && target_option.top !== undefined) {
        if (Math.abs(target_option.top - scroll_top) > client_height) {
          const closest_opt_idx = _options.findIndex((opt) => {
            return opt.top && opt.top + opt.height >= scroll_top + client_height;
          });
          // console.log("[COMPONENT]with-tags-input - offscreen", closest_opt_idx);
          if (closest_opt_idx !== -1) {
            _opt_idx = closest_opt_idx;
          }
        } else if (target_option.top >= scroll_top && target_option.top <= scroll_top + client_height) {
        } else if (target_option.top < scroll_top) {
          ui.$view.setScrollTop(target_option.top - 58);
        } else {
          ui.$view.setScrollTop(0);
        }
      }
      // const menu_height = 24 + 6 + 6;
      // if (_opt_idx * menu_height < scroll_top) {
      //   ui.$view.setScrollTop(scroll_top - menu_height);
      // }
      methods.refresh();
    },
    resetIdx() {
      _opt_idx = 0;
      methods.refresh();
    },
    clearPressedKeys() {
      if (_continuous_timer !== null) {
        clearTimeout(_continuous_timer);
        _continuous_timer = null;
      }
      _continuous_timer = setTimeout(() => {
        _pressed_codes = [];
      }, 200);
    },
    handleEnterMenuOption(idx: number) {
      // if (_using_keyboard) {
      //   return;
      // }
      if (_opt_idx === idx) {
        return;
      }
      _opt_idx = idx;
      methods.refresh();
    },
    handleMoveAtMenuOption() {
      if (_using_keyboard === false) {
        return;
      }
      _using_keyboard = false;
    },
  };
  const ui = {
    $view: props.$view,
    $shortcut: ShortcutModel({}),
  };

  let _options: OptionInMenu[] = [];
  let _displayed_options: { id: string; label: string }[] = [];
  let _opt_idx = 0;
  let _using_keyboard = true;
  let _pressed_codes: string[] = [];
  let _is_continuous_keyboard = false;
  let _continuous_timer: NodeJS.Timeout | number | null = null;
  let _state = {
    get idx() {
      return _opt_idx;
    },
  };
  enum Events {
    StateChange,
    Enter,
    Shortcut,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Enter]: { idx: number; option: OptionInMenu };
    [Events.Shortcut]: { keys: string };
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  // ui.$shortcut.methods.register("KeyGKeyG", () => {
  //   bus.emit(Events.Shortcut, {
  //     keys: "gg",
  //   });
  // });
  // ui.$shortcut.methods.register("KeyJ,ArrowDown", () => {
  //   console.log("[COMPONENT]with-tags-input - handle KeyJ,ArrowDown");
  //   methods.moveToNextOption();
  // });
  // ui.$shortcut.methods.register("ControlRight+KeyD", () => {
  // });
  const shortcut_handler: Record<string, Function> = {
    "KeyK,ArrowUp"() {
      // console.log("[]shortcut - moveToPrevOption");
      methods.moveToPrevOption();
    },
    "ControlRight+KeyU"() {
      methods.moveToPrevOption(3);
    },
    "KeyJ,ArrowDown"() {
      // console.log("[]shortcut - moveToNextOption");
      methods.moveToNextOption();
    },
    "ControlRight+KeyD"() {
      methods.moveToNextOption(3);
    },
    KeyGKeyG() {
      bus.emit(Events.Shortcut, {
        keys: "gg",
      });
    },
    Space() {
      bus.emit(Events.Shortcut, {
        keys: "space",
      });
    },
    Enter() {
      bus.emit(Events.Shortcut, {
        keys: "enter",
      });
    },
    "MetaLeft+KeyR"() {
      bus.emit(Events.Shortcut, {
        keys: "reload",
      });
    },
  };
  ui.$shortcut.methods.register(shortcut_handler);
  // ui.$shortcut.onShortcut(({ key }) => {
  //   console.log("[]onShortcut", key);
  // });

  const unlisten = props.app.onKeydown((event) => {
    console.log("[COMPONENT]props.app.onKeydown", event.code);
    ui.$shortcut.methods.handleKeydown(event);
    // if (event.code === "Enter") {
    //   if (_using_keyboard) {
    //     event.preventDefault();
    //     return;
    //   }
    // }
    // if (event.code === "Space") {
    //   if (_using_keyboard) {
    //     event.preventDefault();
    //     return;
    //   }
    // }
  });
  const unlisten2 = props.app.onKeyup((event) => {
    ui.$shortcut.methods.handleKeyup(event);
  });

  return {
    methods,
    ui,
    state: _state,
    ready() {},
    destroy() {
      unlisten();
      unlisten2();
      bus.destroy();
    },
    onEnter(handler: Handler<TheTypesOfEvents[Events.Enter]>) {
      return bus.on(Events.Enter, handler);
    },
    onShortcut(handler: Handler<TheTypesOfEvents[Events.Shortcut]>) {
      return bus.on(Events.Shortcut, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}

export function WithTagsInputModel(props: { app: ViewComponentProps["app"] } & InputProps<string>) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setOptions(v: { id: string; label: string }[]) {
      _options = v;
      _displayed_options = _options;
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
      // console.log(
      //   "[COMPONENT]WithTagsInput - on keydown",
      //   _selected_options.map((v) => v.id),
      //   _displayed_options[idx]
      // );
      ui.$input.clear();
      methods.refresh();
      props.onEnter?.(ui.$input.value);
    },
    handleEnterMenuOption(idx: number) {
      if (_opt_idx === idx) {
        return;
      }
      _opt_idx = idx;
      methods.refresh();
    },
    handleClickMenuOption(idx: number) {
      methods.selectMenuOption(idx);
      ui.$input.focus();
    },
  };
  const ui = {
    $input: new InputCore({
      defaultValue: props.defaultValue,
      ignoreEnterEvent: true,
      onChange(v) {
        if (v === "#") {
          return;
        }
        if (ui.$input_select.visible) {
          _displayed_options = _options.filter((opt) => {
            return opt.label.toLowerCase().includes(v);
          });
          _opt_idx = 0;
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
      onEnter: props.onEnter,
      onKeyDown(event) {
        // console.log(
        //   "[COMPONENT]WithTagsInput - on keydown",
        //   _opt_idx,
        //   _displayed_options,
        //   _displayed_options[_opt_idx]
        // );
        // console.log(event);
        if (event.key === "Enter") {
          if (ui.$input_select.visible) {
            methods.selectMenuOption(_opt_idx);
            return;
          }
          props.onEnter?.(ui.$input.value);
          return;
        }
        if (ui.$input_select.visible) {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            return;
          }
        }
        if (event.key === "#") {
          event.preventDefault();
          // ui.$input_select.setTriggerPointerDownPos({
          //   x: 80,
          //   y: 48,
          // });
          ui.$input_select.toggle({
            x: 80,
            y: 48,
          });
          return;
        }
        if (event.key === "Backspace") {
          if (ui.$input.value === "" && _selected_options.length !== 0) {
            _selected_options = _selected_options.slice(0, -1);
            _displayed_options = _options;
            methods.refresh();
            props.onEnter?.(ui.$input.value);
            return;
          }
        }
      },
    }),
    $input_select: new PopoverCore({
      closeable: false,
    }),
    $view: new ScrollViewCore({}),
  };

  let _options: { id: string; label: string }[] = [];
  let _displayed_options: { id: string; label: string }[] = [];
  let _opt_idx = 0;
  let _selected_options: { id: string; label: string }[] = [];
  let _state = {
    get options() {
      return _displayed_options.map((opt, idx) => {
        return {
          ...opt,
          // selected: _selected_options.includes(opt.id),
          selected: idx === _opt_idx,
        };
      });
    },
    get value() {
      return {
        keyword: ui.$input.value,
        tags: _selected_options,
      };
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

  ui.$input.onStateChange(() => methods.refresh());
  // ui.$input_select.onHide(() => {
  //   _opt_idx = 0;
  // });
  const unlisten = props.app.onKeydown((event) => {
    // console.log(event.code);
    if (!ui.$input_select.visible) {
      return;
    }
    if (event.code === "ArrowDown") {
      _opt_idx += 1;
      if (_opt_idx > _options.length - 1) {
        _opt_idx = _options.length - 1;
      }
      const scroll_top = ui.$view.getScrollTop();
      const menu_height = 24 + 6 + 6;
      const default_displayed_menu_count = 6;
      if (_opt_idx * menu_height > scroll_top + (default_displayed_menu_count - 1) * menu_height) {
        ui.$view.setScrollTop(scroll_top + menu_height);
      }
      methods.refresh();
    }
    if (event.code === "ArrowUp") {
      _opt_idx -= 1;
      if (_opt_idx < 0) {
        _opt_idx = 0;
      }
      const scroll_top = ui.$view.getScrollTop();
      const menu_height = 24 + 6 + 6;
      if (_opt_idx * menu_height < scroll_top) {
        ui.$view.setScrollTop(scroll_top - menu_height);
      }
      methods.refresh();
    }
    if (event.code === "Escape") {
      ui.$input_select.hide();
    }
  });

  return {
    methods,
    ui,
    state: _state,
    ready() {},
    destroy() {
      unlisten();
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
      <div class="flex items-center border border-w-bg-3 rounded-md p-2 space-x-2">
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
            "bg-transparent": true,
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
      <Popover store={vm.ui.$input_select}>
        <ScrollView
          store={vm.ui.$view}
          classList={{
            "z-50 min-w-[4rem] w-36 max-h-56 overflow-y-auto rounded-xl p-1 text-w-fg-0 shadow-md": true,
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
