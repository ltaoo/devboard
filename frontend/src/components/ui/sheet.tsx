import { X } from "lucide-solid";
import { JSX } from "solid-js/jsx-runtime";

import { useViewModelStore } from "@/hooks";
import { ViewComponentProps } from "@/store/types";
import { DialogCore } from "@/domains/ui/dialog";
import * as DialogPrimitive from "@/packages/ui/dialog";
import { Show } from "@/packages/ui/show";

type SheetProps = {
  position?: "bottom" | "top" | "left" | "right";
  size?: "content" | "default" | "sm" | "lg" | "xl" | "full";
  ignore_safe_height?: boolean;
  plus_idx?: number;
  store: DialogCore;
  app: ViewComponentProps["app"];
} & JSX.HTMLAttributes<HTMLDivElement>;

export function Sheet(props: SheetProps) {
  const [state, vm] = useViewModelStore(props.store);

  return (
    <DialogPrimitive.Portal store={props.store}>
      <Show when={state().mask}>
        <div
          classList={{
            "h-w-screen": true,
            "fixed left-1/2 top-0 -translate-x-1/2 w-[375px] mx-auto": props.app.env.pc,
            "fixed inset-0": !props.app.env.pc,
            hidden: !state().visible,
          }}
          style={{ "z-index": 98 + (props.plus_idx ?? 0) }}
        >
          <DialogPrimitive.Overlay
            store={vm}
            classList={{
              "w-full h-full bg-black/50 transition-all duration-200": true,
              block: state().visible,
              hidden: !state().visible,
              "animate-in fade-in": state().enter,
              "animate-out fade-out": state().exit,
            }}
            onClick={() => {
              vm.hide();
            }}
          />
        </div>
      </Show>
      <div
        class="fixed bottom-0"
        classList={{
          "left-1/2 -translate-x-1/2 w-[375px]": props.app.env.pc,
          "w-full": !props.app.env.pc,
        }}
        style={{ "z-index": 99 + (props.plus_idx ?? 0) }}
      >
        <DialogPrimitive.Content
          store={props.store}
          classList={{
            "z-100 relative": true,
            // [sheetVariants({ position: props.position, size: props.size })]: true,
          }}
        >
          <div
            classList={{
              "duration-200  bg-w-bg-1": true,
              block: state().visible,
              hidden: !state().visible,
              "animate-in slide-in-from-bottom": state().enter,
              "animate-out slide-out-to-bottom": state().exit,
            }}
          >
            {props.children}
          </div>
          <Show when={!props.ignore_safe_height}>
            <div class="safe-height"></div>
          </Show>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}
