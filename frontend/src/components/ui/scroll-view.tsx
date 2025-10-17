/**
 * @file 可滚动容器，支持下拉刷新、滚动监听等
 */
import { JSX, createSignal } from "solid-js";
import { ArrowDown, LoaderCircle } from "lucide-solid";

import * as ScrollViewPrimitive from "@/packages/ui/scroll-view";
import { ScrollViewCore } from "@/domains/ui/scroll-view";

export const ScrollView = (
  props: { store: ScrollViewCore; extra?: JSX.Element } & JSX.HTMLAttributes<HTMLDivElement>
) => {
  // const { store, children, ...rest } = props;

  const [rotate, setRotate] = createSignal(false);

  props.store.inDownOffset(() => {
    setRotate(false);
  });
  props.store.outDownOffset(() => {
    setRotate(true);
  });

  return (
    <ScrollViewPrimitive.Root
      classList={{
        "scroll-view w-full h-full overflow-y-auto": true,
        [props.class ?? ""]: true,
        ...props.classList,
      }}
      style={props.style}
      store={props.store}
      // onClick={rest.onClick}
    >
      <ScrollViewPrimitive.Indicator
        class="scroll-view__indicator relative w-full overflow-hidden text-center"
        store={props.store}
      >
        <div class="absolute left-0 bottom-0 w-full min-h-[30px] py-[10px]">
          <ScrollViewPrimitive.Progress class="w-[50px] h-[50px] mx-auto rounded-full bg-w-bg-0" store={props.store}>
            <div
              classList={{
                "inline-flex justify-center items-center w-full h-full": true,
                "rotate-[180deg]": rotate(),
                "rotate-[0deg]": !rotate(),
              }}
              style={{
                transition: "all 300ms",
              }}
            >
              <ArrowDown width={18} height={18} />
            </div>
          </ScrollViewPrimitive.Progress>
          <ScrollViewPrimitive.Loading class="w-[50px] h-[50px] mx-auto rounded-full bg-w-bg-0" store={props.store}>
            <div class="inline-flex justify-center items-center w-full h-full">
              <LoaderCircle class="animate animate-spin" width={18} height={18} />
            </div>
          </ScrollViewPrimitive.Loading>
        </div>
      </ScrollViewPrimitive.Indicator>
      {props.extra}
      {props.children}
    </ScrollViewPrimitive.Root>
  );
};
