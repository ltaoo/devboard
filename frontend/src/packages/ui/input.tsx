/**
 * @file 输入框
 */
import { createSignal, JSX, onMount } from "solid-js";
import { effect } from "solid-js/web";

import { useViewModelStore } from "@/hooks";

import { InputCore } from "@/domains/ui/form/input";
import { connect } from "@/domains/ui/form/input/connect.web";
import { ValueInputInterface } from "@/domains/ui/form/types";

const Input = (props: { store: InputCore<any> } & JSX.HTMLAttributes<HTMLInputElement>) => {
  let ref: HTMLInputElement | undefined;
  const [state, vm] = useViewModelStore(props.store);

  onMount(() => {
    const $input = ref;
    if (!$input) {
      return;
    }
    connect(vm, $input);
    vm.setMounted();
  });

  const value = () => {
    const { type, value } = state();
    if (type === "file") {
      return "";
    }
    return value;
  };
  const placeholder = () => state().placeholder;
  const disabled = () => state().disabled;
  const type = () => state().type;

  return (
    <input
      {...props}
      ref={ref}
      multiple
      value={value()}
      placeholder={placeholder()}
      disabled={disabled()}
      type={type()}
      autocomplete="false"
      autocorrect="off"
      onInput={(event: Event & { currentTarget: HTMLInputElement }) => {
        // console.log("[COMPONENT]ui/input onInput", event.currentTarget.value);
        vm.handleChange(event);
      }}
      // onChange={(event) => {
      //   console.log("[COMPONENT]ui/input onChange");
      //   store.handleChange(event);
      // }}
      onKeyDown={(event) => {
        vm.handleKeyDown(event);
      }}
    />
  );
};

export { Input };
