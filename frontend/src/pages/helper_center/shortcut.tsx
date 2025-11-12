/**
 * @file 帮助中心/快捷键
 */
import { For, Show } from "solid-js";
import { Check } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { ScrollView } from "@/components/ui";
import { ShortcutKey } from "@/components/shortcut";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { fetchSystemInfo } from "@/biz/system/service";
import { ScrollViewCore } from "@/domains/ui";

function HelperCenterShortcutViewModel(props: ViewComponentProps) {
  const request = {};
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
  };
  let _state = {};
  enum Events {
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

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

export function HelperCenterShortcutView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(HelperCenterShortcutViewModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4 space-y-8">
      <header class="mb-10">
        <h1 class="text-4xl font-bold mb-2">快捷键说明</h1>
      </header>
      <div class="shortcut-section">
        <h2 class="text-2xl font-semibold border-b border-gray-200 pb-3 mb-6">窗口控制</h2>
        <table>
          <thead>
            <tr>
              <td class="p-2 w-[280px]">快捷键</td>
              <td class="p-2">说明</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-2 w-[280px]">需要在设置窗口自定义</td>
              <td class="p-2">
                <div>macOS端</div>
                <div>唤起主窗口</div>
              </td>
            </tr>
            <tr>
              <td class="p-2 w-[280px]">
                <ShortcutKey keys={["Ctrl", ","]} separator="+" />
              </td>
              <td class="p-2">打开设置窗口</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px]">
                <ShortcutKey keys={["Ctrl", "Q"]} separator="+" />
              </td>
              <td class="p-2">退出应用</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="shortcut-section">
        <h2 class="text-2xl font-semibold border-b border-gray-200 pb-3 mb-6">内容选择与操作</h2>
        <table>
          <thead>
            <tr>
              <td class="p-2 w-[280px]">快捷键</td>
              <td class="p-2">说明</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-2 w-[280px] flex gap-2">
                <ShortcutKey keys={["↑"]} />
                <ShortcutKey keys={["K"]} />
              </td>
              <td class="p-2">选择上一条记录</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px] flex gap-2">
                <ShortcutKey keys={["↓"]} />
                <ShortcutKey keys={["J"]} />
              </td>
              <td class="p-2">选择下一条记录</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px] flex gap-2">
                <ShortcutKey keys={["Ctrl", "U"]} />
              </td>
              <td class="p-2">快速往上移动</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px] flex gap-2">
                <ShortcutKey keys={["Ctrl", "D"]} />
              </td>
              <td class="p-2">快速往下移动</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px]">
                <ShortcutKey keys={["GG"]} />
              </td>
              <td class="p-2">快速定位到第一条记录</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px]">
                <ShortcutKey keys={["Space"]} />
              </td>
              <td class="p-2">预览选择的记录</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px] flex gap-2">
                <ShortcutKey keys={["YY"]} />
                <ShortcutKey keys={["Enter"]} />
              </td>
              <td class="p-2">将记录复制到粘贴板</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px] flex gap-2">
                <ShortcutKey keys={["Shift", "Backspace"]} />
              </td>
              <td class="p-2">删除选择的记录</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="shortcut-section">
        <h2 class="text-2xl font-semibold border-b border-gray-200 pb-3 mb-6">搜索</h2>
        <table>
          <thead>
            <tr>
              <td class="p-2 w-[280px]">快捷键</td>
              <td class="p-2">说明</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-2 w-[280px] flex gap-2">
                <ShortcutKey keys={["Ctrl", "F"]} />
                <ShortcutKey keys={["O"]} />
              </td>
              <td class="p-2">聚焦到搜索框</td>
            </tr>
            <tr>
              <td class="p-2 w-[280px]">
                <ShortcutKey keys={["Shift", "3"]} />
              </td>
              <td class="p-2">
                <div>搜索框为空时</div>
                <div>聚焦到搜索框并展示标签</div>
              </td>
            </tr>
            <tr>
              <td class="p-2 w-[280px]">
                <ShortcutKey keys={["Esc"]} />
              </td>
              <td class="p-2">搜索框失焦</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ScrollView>
  );
}
