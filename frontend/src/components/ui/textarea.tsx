import { createSignal } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

import { InputCore } from "@/domains/ui/form/input";

export interface TextareaProps extends HTMLTextAreaElement {}

const Textarea = (props: { store: InputCore<string> } & JSX.HTMLAttributes<HTMLTextAreaElement>) => {
  const { store, class: className, ...restProps } = props;

  const [state, setState] = createSignal(store.state);
  store.onStateChange((nextState) => {
    setState(nextState);
  });

  const value = () => state().value;
  const placeholder = () => state().placeholder;
  const disabled = () => state().disabled;

  return (
    <textarea
      ref={props.ref}
      classList={{
        "flex h-20 w-full rounded-xl border-2 border-w-fg-3 text-w-fg-0 bg-transparent py-2 px-3 placeholder:text-w-fg-2 focus:outline-none focus:ring-2 focus:ring-w-bg-3 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-50 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900":
          true,
        [props.class ?? ""]: true,
      }}
      value={value()}
      placeholder={placeholder()}
      disabled={disabled()}
      onInput={(event: Event & { currentTarget: HTMLTextAreaElement }) => {
        const { value } = event.currentTarget;
        store.setValue(value);
      }}
      {...restProps}
    />
  );
};
Textarea.displayName = "Textarea";

export { Textarea };
