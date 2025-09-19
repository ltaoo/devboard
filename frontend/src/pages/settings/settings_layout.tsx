import { ViewComponentProps } from "@/store/types";
import { RouteChildren } from "@/components/route-children";

export function SettingsView(props: ViewComponentProps) {
  return (
    <div class="flex">
      <div class="p-4 w-[120px]">
        <div class="space-y-1">
          <div class="px-4 py-2 rounded-md cursor-pointer hover:bg-w-bg-3">同步</div>
          <div class="px-4 py-2 rounded-md cursor-pointer hover:bg-w-bg-3">系统</div>
        </div>
      </div>
      <div class="flex-1 w-0 p-4">
        <div class="relative">
          <RouteChildren {...props} />
        </div>
      </div>
    </div>
  );
}
