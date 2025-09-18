import { ViewComponentProps } from "@/store/types";

export function ErrorTipView(props: ViewComponentProps) {
  return (
    <div class="p-4">
      <div class="text-center">
        <div class="text-xl">{props.view.query.title}</div>
        <div class="mt-4">{props.view.query.desc}</div>
      </div>
    </div>
  );
}
