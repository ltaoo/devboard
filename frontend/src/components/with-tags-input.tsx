/**
 * @file 支持输入标签的输入框
 */
import { For } from "solid-js";

import { ViewComponentProps } from "@/store/types";
import { useViewModelStore } from "@/hooks";
import { Input as InputPrimitive } from "@/packages/ui/input";
import { Input } from "@/components/ui/input";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { InputCore, InputProps, PopoverCore, ScrollViewCore, SelectCore } from "@/domains/ui";

import { Popover, ScrollView } from "./ui";
import { Select } from "./ui/select";
import { Presence } from "./ui/presence";
import { Bird } from "lucide-solid";

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
        console.log(
          "[COMPONENT]WithTagsInput - on keydown",
          _opt_idx,
          _displayed_options,
          _displayed_options[_opt_idx]
        );
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
  props.app.onKeydown((event) => {
    console.log(event.key);
    if (!ui.$input_select.visible) {
      return;
    }
    if (event.key === "ArrowDown") {
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
    if (event.key === "ArrowUp") {
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
    if (event.key === "Escape") {
      ui.$input_select.hide();
    }
  });

  return {
    methods,
    ui,
    state: _state,
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
