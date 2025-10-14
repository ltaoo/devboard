/**
 * @file 帮助中心/快捷键
 */
import { For, Show } from "solid-js";
import { Check } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { ScrollView } from "@/components/ui";

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
      <header class="text-center mb-10">
        <h1 class="text-4xl font-bold text-indigo-600 mb-2">快捷键说明</h1>
        <p class="text-lg text-gray-500">提高效率的快捷操作指南</p>
      </header>

      <div class="shortcut-section">
        <h2 class="text-2xl font-semibold text-indigo-500 border-b border-gray-200 pb-3 mb-6">简要说明</h2>
        <ol class="list-decimal pl-5 space-y-3">
          <li>
            按下 <kbd class="key">⌘</kbd>+<kbd class="key">Shift</kbd>+<kbd class="key">M</kbd> 组合键可快速调出窗口
          </li>
          <li>
            使用 <kbd class="key">↑</kbd>/<kbd class="key">↓</kbd> 或 <kbd class="key">j</kbd>/<kbd class="key">k</kbd>{" "}
            键浏览选项
          </li>
          <li>
            输入 <kbd class="key">g</kbd>
            <kbd class="key">g</kbd> 可立即返回列表最上方
          </li>
          <li>
            按 <kbd class="key">Esc</kbd> 键可随时隐藏窗口
          </li>
        </ol>
      </div>

      <div class="shortcut-section">
        <h2 class="text-2xl font-semibold text-indigo-500 border-b border-gray-200 pb-3 mb-6">窗口控制</h2>

        <div class="flex items-center py-4 border-b border-gray-100">
          <div class="flex mr-5">
            <kbd class="key">⌘</kbd>
            <span>+</span>
            <kbd class="key">Shift</kbd>
            <span>+</span>
            <kbd class="key">M</kbd>
          </div>
          <div class="flex-1">唤起/显示窗口</div>
        </div>

        <div class="flex items-center py-4  border-b border-gray-100">
          <div class="flex mr-5">
            <kbd class="key">Esc</kbd>
          </div>
          <div class="flex-1">隐藏窗口</div>
        </div>

        <div class="flex items-center py-4  border-b border-gray-100">
          <div class="flex mr-5">
            <kbd class="key">⌘</kbd>
            <span>+</span>
            <kbd class="key">,</kbd>
          </div>
          <div class="flex-1">打开设置窗口</div>
        </div>

        <div class="flex items-center py-4">
          <div class="flex mr-5">
            <kbd class="key">⌘</kbd>
            <span>+</span>
            <kbd class="key">Q</kbd>
          </div>
          <div class="flex-1">退出应用</div>
        </div>
      </div>

      <div class="shortcut-section">
        <h2 class="text-2xl font-semibold text-indigo-500 border-b border-gray-200 pb-3 mb-6">导航控制</h2>

        <div class="flex items-center py-4 border-b border-gray-100">
          <div class="flex mr-5">
            <kbd class="key">↑</kbd>
          </div>
          <div class="flex-1">向上移动选择项</div>
        </div>

        <div class="flex items-center py-4 border-b border-gray-100">
          <div class="flex mr-5">
            <kbd class="key">k</kbd>
          </div>
          <div class="flex-1">向上移动选择项</div>
        </div>

        <div class="flex items-center py-4 border-b border-gray-100">
          <div class="flex mr-5">
            <kbd class="key">↓</kbd>
          </div>
          <div class="flex-1">向下移动选择项</div>
        </div>

        <div class="flex items-center py-4 border-b border-gray-100">
          <div class="flex mr-5">
            <kbd class="key">j</kbd>
          </div>
          <div class="flex-1">向下移动选择项</div>
        </div>

        <div class="flex items-center py-4">
          <div class="flex mr-5">
            <kbd class="key">g</kbd>
            <kbd class="key">g</kbd>
          </div>
          <div class="flex-1">
            快速回到列表顶部
            <span class="vim-badge">Vim</span>
          </div>
        </div>
      </div>
    </ScrollView>
  );
}
