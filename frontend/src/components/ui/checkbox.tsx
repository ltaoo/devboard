import { Show } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Check } from "lucide-solid";

import * as CheckboxPrimitive from "@/packages/ui/checkbox";

import { CheckboxCore } from "@/domains/ui/checkbox";

export function Checkbox(props: { store: CheckboxCore } & JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <CheckboxPrimitive.Root id={props.id} store={props.store} class="flex items-center gap-1">
      <div
        classList={{
          "peer flex items-center w-4 h-4 shrink-0 rounded-sm border border-w-fg-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground":
            true,
        }}
      >
        <CheckboxPrimitive.Indicator
          store={props.store}
          classList={{
            "flex items-center justify-center text-current": true,
          }}
        >
          <Check class="h-4 w-4" />
        </CheckboxPrimitive.Indicator>
      </div>
      <Show when={props.children}>
        <div class="whitespace-nowrap">{props.children}</div>
      </Show>
    </CheckboxPrimitive.Root>
  );
}
