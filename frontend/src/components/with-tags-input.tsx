/**
 * @file 支持输入标签的输入框
 */
import { For } from "solid-js";

import { useViewModelStore } from "@/hooks";
import { Input as InputPrimitive } from "@/packages/ui/input";
import { Input } from "@/components/ui/input";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { InputCore, InputProps } from "@/domains/ui";

export function WithTagsInputModel(props: InputProps<string>) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $input: new InputCore({
      defaultValue: props.defaultValue,
      onChange(v) {
        const last_char = v[v.length - 1];
        if (last_char !== " ") {
          return;
        }
        const is_tag = v.match(/^#[a-zA-Z0-9-]{1,} /);
        if (!is_tag) {
          return;
        }
        _tags = [..._tags, v.trim()];
        methods.refresh();
        ui.$input.setValue("");
      },
      onEnter: props.onEnter,
      onKeyDown(event) {
        console.log(event);
        if (event.key === "Backspace") {
          if (ui.$input.value === "" && _tags.length !== 0) {
            _tags = _tags.slice(0, -1);
            methods.refresh();
          }
        }
      },
    }),
  };

  let _tags: string[] = [];
  let _state = {
    get tags() {
      return _tags;
    },
    get value() {
      return ui.$input.value;
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
    <div class="flex items-center border border-w-bg-3 rounded-md p-2 space-x-2">
      <div class="flex space-x-1">
        <For each={state().tags}>
          {(tag) => {
            return (
              <div class="">
                <div class="text-w-fg-0 whitespace-nowrap">{tag}</div>
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
  );
}
