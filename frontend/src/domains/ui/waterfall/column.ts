import { base, BaseDomain, Handler } from "@/domains/base";
import { throttle } from "@/utils/lodash/throttle";
import { remove_arr_item, toFixed } from "@/utils";

import { WaterfallCellModel } from "./cell";
import { inRange } from "@/utils/primitive";

export function WaterfallColumnModel<T extends Record<string, unknown>>(props: {
  index?: number;
  size?: number;
  buffer?: number;
  gutter?: number;
}) {
  function handleScrollForce(values: { scrollTop: number }) {
    const { scrollTop } = values;
    _scroll = values;
    if (_scroll.scrollTop < 0) {
      return;
    }
    const range = methods.calcVisibleRange(scrollTop);
    const update = (() => {
      if (scrollTop === 0) {
        return true;
      }
      if (range.start !== _start || range.end !== _end) {
        return true;
      }
      return false;
    })();
    console.log("[]handleScrollForce - before if (!update", update, scrollTop, range);
    if (!update) {
      return;
    }
    methods.update(range);
  }
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    setHeight(h: number) {
      _height = h;
      methods.refresh();
    },
    addHeight(h: number) {
      const height = _height + h;
      methods.setHeight(height);
    },
    setClientHeight(v: number) {
      _client_height = v;
    },
    /**
     * 放置一个 item 到列中
     */
    appendItem($item: WaterfallCellModel<T>) {
      $item.onHeightChange(([original_height, height_difference]) => {
        const idx = _$total_items.findIndex((v) => v.id === $item.id);
        if (idx !== -1) {
          const $next = _$total_items[idx + 1];
          if ($next) {
            // console.log(
            //   "[DOMAIN]appendItem - before setTopWithDifference",
            //   [_index, $item.idx],
            //   height_difference,
            //   $next.state.top
            // );
            $next.methods.setTopWithDifference(height_difference);
          }
        }
        console.log(
          "[DOMAIN]appendItem - after this.height += heightDiff",
          "加载完成，发现高度差异为",
          [_index, $item.idx, idx],
          [original_height, height_difference]
        );
        _height += height_difference;
        bus.emit(Events.HeightChange, _height);
        methods.refresh();
      });
      $item.onTopChange(([, top_difference]) => {
        const idx = _$total_items.findIndex((v) => v === $item);
        if (idx !== -1) {
          const $next = _$total_items[idx + 1];
          if ($next) {
            $next.methods.setTopWithDifference(top_difference);
          }
        }
      });
      const idx = _$total_items.length;
      // $item.methods.setIndex(idx);
      $item.methods.setColumnIdx(_index);
      _height += $item.state.height + _gutter;
      _$total_items.push($item);
      const $prev = _$total_items[idx - 1];
      console.log(
        "[DOMAIN]waterfall/column - append item",
        idx,
        $prev?.state.top,
        $prev?.state.height,
        $prev?.state.top + $prev?.state.height + _gutter
      );
      if ($prev) {
        $item.methods.setTop($prev.state.top + $prev.state.height + _gutter);
      }
      _$items = _$total_items.slice(_start, _end + _buffer_size);
      bus.emit(Events.HeightChange, _height);
      // bus.emit(Events.StateChange, _state);
    },
    /**
     * 往顶部插入一个 item 到列中
     */
    unshiftItem($item: WaterfallCellModel<T>, opt: Partial<{ skipUpdateHeight: boolean }> = {}) {
      $item.onHeightChange(([original_height, height_difference]) => {
        _height += height_difference;
        const idx = _$total_items.findIndex((v) => v === $item);
        if (idx !== -1) {
          const $next = _$total_items[idx + 1];
          if ($next) {
            $next.methods.setTopWithDifference(height_difference);
          }
        }
      });
      $item.onTopChange(([, top_difference]) => {
        const idx = _$total_items.findIndex((v) => v === $item);
        console.log("[BIZ]waterfall/column - response the top change", idx, $first.id, $first.state.top, $item.height);
        if (idx !== -1) {
          const $next = _$total_items[idx + 1];
          if ($next) {
            $next.methods.setTopWithDifference(top_difference);
          }
        }
      });
      const idx = _$total_items.length;
      const $first = _$total_items[0];
      if ($first) {
        console.log("[BIZ]waterfall/column - before $first set top", idx, $first.id, $first.state.top, $item.height);
        $first.methods.setTopWithDifference($item.height + _gutter);
        // console.log("[BIZ]waterfall/column - after $first set top", idx, $first.id, $first.state.top, $item.height);
      }
      // const idx = _$items.findIndex((v) => v === $item);
      // if (idx !== -1) {
      //   const $next = _$items[idx + 1];
      //   if ($next) {
      //     $next.methods.setTopWithDifference(height_difference);
      //   }
      // }
      // $item.methods.setIndex(idx);
      $item.methods.setColumnIdx(_index);
      // if (!opt.skipUpdateHeight) {
      _height += $item.height + _gutter;
      // }
      _$total_items.unshift($item);
      // for (let i = 0; i < _$total_items.length; i += 1) {
      //   const $next = _$total_items[i];
      //   if ($next) {
      //     console.log(i, $item.height);
      //     $next.methods.setTopWithDifference($item.height + _gutter);
      //   }
      // }
      bus.emit(Events.HeightChange, _height);
      methods.refresh();
    },
    findItemById(id: number) {
      return _$total_items.find((v) => v.id === id);
    },
    deleteCell($item: WaterfallCellModel<T>) {
      // const idx = $item.idx;
      const idx = _$total_items.findIndex((v) => v.id === $item.id);
      if (idx === -1) {
        return;
      }
      const $next = _$total_items[idx + 1];
      const $backup = _$total_items[_end];
      const height_difference = $item.height + _gutter;
      _height -= height_difference;
      console.log("[BIZ]waterfall/column - delete cell", idx, $next?.idx, height_difference);
      if ($next) {
        $next.methods.setTopWithDifference(-height_difference);
      }
      _$total_items = remove_arr_item(_$total_items, idx);
      const idx2 = _$items.findIndex((v) => v.id === $item.id);
      // const idx3 = _$items
      if (idx2 !== -1) {
        _$items = remove_arr_item(_$items, idx2);
        if ($backup) {
          _$items.push($backup);
        }
      }
      methods.refresh();
    },
    clean() {
      _$items = [];
      _$total_items = [];
      _height = 0;
      bus.emit(Events.StateChange, { ..._state });
    },
    handleScrollForce,
    handleScroll: throttle(100, handleScrollForce),
    resetRange() {
      _start = 0;
      _end = _size + _buffer_size;
      _$items = _$total_items.slice(_start, _end);
      methods.refresh();
      // methods.calcVisibleRange(0);
    },
    calcVisibleRange(scroll_top: number) {
      console.log("[BIZ]waterfall/column - calcVisibleRange", scroll_top, _start, _end, _$items);
      // 找中点需要遍历几万个元素，不是最佳方案
      // const $middle_item = (() => {
      //   return _$total_items.find(($v) => {
      //     console.log(vvv, [$v.state.top - 100, $v.state.top, $v.state.top + 100]);
      //     return inRange(vvv, [$v.state.top - 100, $v.state.top + 100]);
      //   });
      // })();
      // console.log($middle_item?.idx);

      // const items = _$total_items;
      // const $cur_first = _$items[0];
      // if (!$cur_first) {
      //   return {
      //     start: _start,
      //     end: _end,
      //   };
      // }
      // let items_height_total = $cur_first.state.top;
      // console.log("before", this.range, start, end);
      let start = _start;
      let end = _end;
      (() => {
        // for (let i = start; i < end + 1; i += 1) {
        //   const $item = _$total_items[i];
        //   if ($item) {
        //     $item.methods.setTop(items_height_total);
        //     items_height_total = toFixed(items_height_total + $item.state.height + _gutter, 0);
        //   }
        // }
        // 这里是从全部列表中，找出应该从哪里开始展示的逻辑
        for (let i = start; i < _$total_items.length; i += 1) {
          const item = _$total_items[i];
          if (item.state.top >= scroll_top) {
            // 这个 -1 是为什么？
            start = i;
            end = start + _size;
            return;
          }
        }
        // const vvv = scroll_top + _client_height / 2;
        // const idx = _$total_items.findIndex(($v) => {
        //   return inRange(vvv, [$v.state.top - 100, $v.state.top + 100]);
        // });
        // if (idx === -1) {
        //   return;
        // }
        // start = Math.max(0, idx - _size);
        // end = Math.min(_$total_items.length, start + _size);
      })();
      //     const count = this.buffer_size;
      console.log("before Math.max", [start, start - _buffer_size], [end, _$total_items.length]);
      const result = { start: Math.max(0, start - _buffer_size), end: Math.min(end, _$total_items.length) };
      return result;
    },
    update(range: { start: number; end: number }) {
      console.log("[DOMAIN]waterfall/column - update case range is changed", range);
      const $visible_items = _$total_items.slice(range.start, range.end);
      const item = $visible_items[0];
      if (!item) {
        return;
      }
      // _range = range;
      _start = range.start;
      _end = range.end;
      _$items = $visible_items;
      methods.refresh();
    },
  };

  /** 该列下标 */
  let _index = props.index ?? 0;
  /** 该列累计高度 */
  let _height = 0;
  let _width = 0;
  let _innerTop = 0;
  let _client_height = 0;
  /** 显示的元素 */
  let _$items: WaterfallCellModel<T>[] = [];
  let _$total_items: WaterfallCellModel<T>[] = [];
  /** 默认显示的数量 */
  let _size = props.size ?? 4;
  /** 缓冲的数量 */
  let _buffer_size = props.buffer ?? 1;
  /** 每个元素和下面元素的距离 */
  let _gutter = props.gutter ?? 0;
  let _scroll = { scrollTop: 0 };
  // let _range = { start: 0, end: _size + _buffer_size };
  let _start = 0;
  let _end = _size + _buffer_size;

  const _state = {
    get width() {
      return _width;
    },
    get height() {
      return _height;
    },
    get size() {
      return _size;
    },
    get items() {
      return _$items.map((v) => v.state);
    },
    get item_count() {
      return _$items.length;
    },
    get innerTop() {
      return _innerTop;
    },
    //       visibleItems: this.totalItems,
    //       range: this.range,
  };

  enum Events {
    StateChange,
    HeightChange,
  }
  type TheTypesOfEvents = {
    [Events.HeightChange]: number;
    [Events.StateChange]: typeof _state;
  };

  const bus = base<TheTypesOfEvents>();
  let _id = bus.uid();

  return {
    state: _state,
    get $cells() {
      return _$items;
    },
    get range() {
      return {
        start: _start,
        end: _end,
      };
    },
    methods,
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      bus.on(Events.StateChange, handler);
    },
    onHeightChange(handler: Handler<TheTypesOfEvents[Events.HeightChange]>) {
      bus.on(Events.HeightChange, handler);
    },
  };
}

export type WaterfallColumnModel<T extends Record<string, unknown>> = ReturnType<typeof WaterfallColumnModel<T>>;
