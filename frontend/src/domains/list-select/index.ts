import { base, Handler } from "@/domains/base";
import { ScrollViewCore } from "@/domains/ui";
import { BizError } from "@/domains/error";

export type OptionWithTopInList = { id: string; label: string; height: number; top?: number };

export function ListSelectModel(props: { $view: ScrollViewCore; num?: number }) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setOptions(list: OptionWithTopInList[]) {
      // console.log("[COMPONENT]with-tags-input - setOptions", list);
      _options = list;
      _displayed_options = _options;
    },
    appendOptions(list: OptionWithTopInList[]) {
      // console.log("[COMPONENT]with-tags-input - setOptions", list);
      _options = [..._options, ...list];
      _displayed_options = _options;
    },
    deleteOptionById(id: string) {
      // console.log("[COMPONENT]with-tags-input - deleteOptionById", id);
      _options = _options.filter((opt) => opt.id !== id);
      _displayed_options = _options;
    },
    unshiftOption(v: OptionWithTopInList) {
      // console.log("[COMPONENT]with-tags-input - unshiftOption", v);
      _options.unshift(v);
      _opt_idx += 1;
      if (_opt_idx > _options.length - 1) {
        _opt_idx = _options.length - 1;
      }
    },
    updateOption(v: OptionWithTopInList) {
      const idx = _options.findIndex((opt) => opt.id === v.id);
      // console.log("[COMPONENT]with-tags-input - updateOption", v.id, v.top, idx);
      if (idx === -1) {
        // console.error("[COMPONENT]with-tags-input - not found matched opt");
        return;
      }
      _options[idx] = v;
      methods.refresh();
    },
    selectMenuOption(idx: number) {
      // ui.$input_select.hide();
      // const matched = { ..._displayed_options[idx] };
      // const existing = _selected_options.find((v) => v.id === matched.id);
      // if (existing) {
      //   return;
      // }
      // _selected_options.push(matched);
      // _displayed_options = [..._options];
      // ui.$input.clear();
      // methods.refresh();
    },
    moveToNextOption(opt: Partial<{ step: number; force: boolean }> = {}) {
      const { step = 1, force = false } = opt;
      console.log("[COMPONENT]with-tags-input - moveToNextOption", _opt_idx, _options);
      if (_options.length === 0) {
        return;
      }
      const is_last_one = _opt_idx === _options.length - 1;
      if (is_last_one) {
        return;
      }
      _opt_idx += step;
      if (_opt_idx > _options.length - 1) {
        _opt_idx = _options.length - 1;
      }
      const scroll_top = ui.$view.getScrollTop();
      const client_height = ui.$view.getScrollClientHeight();
      const target_option = _options[_opt_idx];
      // console.log(
      //   "[COMPONENT]with-tag - moveToNext calc need scroll the container",
      //   _opt_idx,
      //   client_height,
      //   scroll_top,
      //   target_option
      // );
      if (target_option && target_option.top !== undefined) {
        const cur_option_in_up_area = target_option.top + target_option.height - scroll_top < 0;
        const cur_option_in_bottom_area = Math.abs(target_option.top - scroll_top) > client_height;
        // console.log("[COMPONENT]with-tag - moveToNext need goto option", cur_option_in_up_area, cur_option_in_bottom_area);
        // console.log(target_option.top, scroll_top, client_height);
        if (!force && (cur_option_in_up_area || cur_option_in_bottom_area)) {
          const closest_opt_idx = _options.findIndex((opt) => {
            return opt.top && opt.top >= scroll_top;
          });
          if (closest_opt_idx !== -1) {
            // const closest_opt = _options[closest_opt_idx];
            // console.log(closest_opt);
            // console.log("[COMPONENT]with-tag - moveToNext direct to option", closest_opt_idx);
            _opt_idx = closest_opt_idx;
          }
        } else if (target_option.top > client_height / 2 + scroll_top) {
          // ui.$view.scrollTo({ top: cur_option.top - client_height / 2 });
          ui.$view.setScrollTop(target_option.top - client_height / 2);
        }
      }
      // const menu_height = 24 + 6 + 6;
      // if (_opt_idx * menu_height > scroll_top + (default_displayed_menu_count - 1) * menu_height) {
      //   ui.$view.setScrollTop(scroll_top + menu_height);
      // }
      methods.refresh();
    },
    moveToPrevOption(opt: Partial<{ step: number; force: boolean }> = {}) {
      const { step = 1, force = false } = opt;
      console.log("[COMPONENT]with-tags-input - moveToPrevOption", _opt_idx, _options.length);
      const cur_option = _options[_opt_idx];
      if (_opt_idx === 0) {
        return;
      }
      _opt_idx -= step;
      if (_opt_idx < 0) {
        _opt_idx = 0;
      }
      const target_option = _options[_opt_idx];
      const scroll_top = ui.$view.getScrollTop();
      const client_height = ui.$view.getScrollClientHeight();
      // console.log(
      //   "[COMPONENT]with-tags-input - calc need scroll the container",
      //   _opt_idx,
      //   client_height,
      //   scroll_top,
      //   cur_option.top,
      //   target_option
      // );
      if (target_option && target_option.top !== undefined) {
        if (Math.abs(target_option.top - scroll_top) > client_height) {
          const closest_opt_idx = _options.findIndex((opt) => {
            return opt.top && opt.top + opt.height >= scroll_top + client_height;
          });
          // console.log("[COMPONENT]with-tags-input - offscreen", closest_opt_idx);
          if (closest_opt_idx !== -1) {
            _opt_idx = closest_opt_idx;
          }
        } else if (target_option.top >= scroll_top && target_option.top <= scroll_top + client_height) {
        } else if (target_option.top < scroll_top) {
          ui.$view.setScrollTop(target_option.top - 58);
        } else {
          ui.$view.setScrollTop(0);
        }
      }
      // const menu_height = 24 + 6 + 6;
      // if (_opt_idx * menu_height < scroll_top) {
      //   ui.$view.setScrollTop(scroll_top - menu_height);
      // }
      methods.refresh();
    },
    setIdx(idx: number) {
      if (_opt_idx === idx) {
        return;
      }
      _opt_idx = idx;
      methods.refresh();
    },
    resetIdx() {
      _opt_idx = 0;
      methods.refresh();
    },
    handleEnterMenuOption(idx: number) {
      // if (_using_keyboard) {
      //   return;
      // }
      if (_opt_idx === idx) {
        return;
      }
      _opt_idx = idx;
      methods.refresh();
    },
    handleMoveAtMenuOption() {
      if (_using_keyboard === false) {
        return;
      }
      _using_keyboard = false;
    },
  };
  const ui = {
    $view: props.$view,
    // $shortcut: ShortcutModel({}),
  };

  let _options: OptionWithTopInList[] = [];
  let _displayed_options: { id: string; label: string }[] = [];
  let _opt_idx = 0;
  let _using_keyboard = true;
  let _state = {
    get idx() {
      return _opt_idx;
    },
  };
  enum Events {
    StateChange,
    Enter,
    Shortcut,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Enter]: { idx: number; option: OptionWithTopInList };
    [Events.Shortcut]: { keys: string };
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
    onEnter(handler: Handler<TheTypesOfEvents[Events.Enter]>) {
      return bus.on(Events.Enter, handler);
    },
    onShortcut(handler: Handler<TheTypesOfEvents[Events.Shortcut]>) {
      return bus.on(Events.Shortcut, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}

export type ListSelectModel = ReturnType<typeof ListSelectModel>;
