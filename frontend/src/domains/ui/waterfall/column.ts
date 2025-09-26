import { base, BaseDomain, Handler } from "@/domains/base";
import { throttle } from "@/utils/lodash/throttle";
import { toFixed } from "@/utils";

import { WaterfallCellModel } from "./cell";

export function WaterfallColumnModel<T>(props: { index?: number; size?: number; buffer?: number; gutter?: number }) {
  function handleScrollForce(values: { scrollTop: number }) {
    const { scrollTop } = values;
    _scroll = values;
    const range = methods.calcVisibleRange(scrollTop);
    const update = (() => {
      if (scrollTop === 0) {
        return true;
      }
      if (range.start !== _range.start || range.end !== _range.end) {
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
    /**
     * 放置一个 item 到列中
     */
    appendItem(item: WaterfallCellModel<T>) {
      item.onHeightChange(([original_height, height_difference]) => {
        _height += height_difference;
        const idx = _$items.findIndex((v) => v.id === item.id);
        if (idx !== -1) {
          const $next = _$items[idx + 1];
          if ($next) {
            console.log(
              "[DOMAIN]appendItem - before setTopWithDifference",
              [_index, item.idx],
              height_difference,
              $next.state.top
            );
            $next.methods.setTopWithDifference(height_difference);
            console.log("[DOMAIN]appendItem - after setTopWithDifference", $next.state.top);
          }
        }
        console.log(
          "[DOMAIN]appendItem - after this.height += heightDiff",
          "加载完成，发现高度差异为",
          [_index, item.idx],
          [original_height, height_difference]
        );
        bus.emit(Events.HeightChange, _height);
        // methods.handleScroll(_scroll);
        methods.refresh();
        // methods.handleScroll(_)
        //       this.emit(Events.StateChange, { ...this.state });
      });
      item.onTopChange(([, top_difference]) => {
        const idx = _$total_items.findIndex((v) => v === item);
        if (idx) {
          const $next = _$total_items[idx + 1];
          if ($next) {
            $next.methods.setTopWithDifference(top_difference);
          }
        }
      });
      item.methods.setIndex(_$total_items.length);
      item.methods.setColumn(_index);
      _height += item.state.height + _gutter;
      _$total_items.push(item);
      _$items = _$total_items.slice(_range.start, _range.end + _buffer_size);
      bus.emit(Events.HeightChange, _height);
      // bus.emit(Events.StateChange, _state);
    },
    /**
     * 往顶部插入一个 item 到列中
     */
    unshiftItem(item: WaterfallCellModel<T>, opt: Partial<{ skipUpdateHeight: boolean }> = {}) {
      item.onHeightChange(([original_height, height_difference]) => {
        // _height += height_difference;
        // const idx = _$items.findIndex((v) => v === item);
        // if (idx !== -1) {
        //   const $next = _$items[idx + 1];
        //   if ($next) {
        //     $next.methods.setTopWithDifference(height_difference);
        //   }
        // }
      });
      item.onTopChange(([, top_difference]) => {
        // const idx = _$items.findIndex((v) => v === item);
        // if (idx) {
        //   const $next = _$items[idx + 1];
        //   if ($next) {
        //     $next.methods.setTopWithDifference(top_difference);
        //   }
        // }
      });
      // for (let i = 0; i < _$total_items.length; i += 1) {
      //   const $item = _$total_items[i];
      //   $item.methods.setTopWithDifference(item.height);
      // }
      item.methods.setIndex(_$total_items.length);
      item.methods.setColumn(_index);
      if (!opt.skipUpdateHeight) {
        _height += item.height + _gutter;
      }
      _$total_items.unshift(item);
      bus.emit(Events.HeightChange, _height);
      methods.refresh();
    },
    findItemById(id: number) {
      return _$total_items.find((v) => v.id === id);
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
      _range = { start: 0, end: _size + _buffer_size };
      _$items = _$total_items.slice(_range.start, _range.end);
      methods.calcVisibleRange(0);
    },
    calcVisibleRange(scroll_top: number) {
      // const items = _$total_items;
      const $cur_first = _$items[0];
      if (!$cur_first) {
        return _range;
      }
      let items_height_total = $cur_first.state.top;
      // console.log("before", this.range, start, end);
      let { start, end } = _range;
      (() => {
        for (let i = start; i < end + 1; i += 1) {
          const $item = _$total_items[i];
          if (!$item) {
            return;
          }
          // console.log("[DOMAIN]ui/waterfall/column - calcVisibleRange - before setTop", items_height_total);
          $item.methods.setTop(items_height_total);
          // console.log("set top", itemsHeightTotal, scrollTop);
          items_height_total = toFixed(items_height_total + $item.state.height + _gutter, 0);
          // if (itemsHeightTotal >= scrollTop) {
          //   start = i;
          //   end = start + this.size;
          //   console.log("before return", start, end);
          //   return;
          // }
        }
        for (let i = start; i < _$total_items.length; i += 1) {
          const item = _$total_items[i];
          // console.log(i, item);
          // item.top = itemsHeightTotal;
          if (item.state.top >= scroll_top) {
            // 这个 -1 是为什么？
            start = i - 1;
            end = start + _size;
            // console.log("before return", start, end);
            return;
          }
        }
      })();
      //     const count = this.buffer_size;
      // console.log("before Math.max", start, start - this.buffer_size);
      const result = { start: Math.max(0, start - _buffer_size), end: Math.min(end, _$total_items.length) };
      return result;
    },
    update(range: { start: number; end: number }) {
      // console.log("[DOMAIN]waterfall/column - update case range is changed", range);
      const $visible_items = _$total_items.slice(range.start, range.end);
      const item = $visible_items[0];
      if (!item) {
        return;
      }
      _range = range;
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
  let _range = { start: 0, end: _size + _buffer_size };

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
    methods,
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      bus.on(Events.StateChange, handler);
    },
    onHeightChange(handler: Handler<TheTypesOfEvents[Events.HeightChange]>) {
      bus.on(Events.HeightChange, handler);
    },
  };
}

export type WaterfallColumnModel<T> = ReturnType<typeof WaterfallColumnModel<T>>;
