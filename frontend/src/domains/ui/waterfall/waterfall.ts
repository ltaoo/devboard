import { base, BaseDomain, Handler } from "@/domains/base";

import { WaterfallColumnModel } from "./column";
import { WaterfallCellModel } from "./cell";
import { remove_arr_item } from "@/utils";

export function WaterfallModel<T extends Record<string, unknown>>(props: {
  column?: number;
  size?: number;
  buffer?: number;
  gutter?: number;
  itemHeight?: number;
}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    initializeColumns(v: typeof props) {
      const { size, buffer, gutter } = v;
      if (_initialized) {
        return;
      }
      // const { columns = 2 } = ;
      const columns = _column;
      if (_$columns.length === columns) {
        return;
      }
      for (let i = 0; i < columns; i += 1) {
        // console.log("[]before new ListColumnViewCore", size);
        const $column = WaterfallColumnModel<T>({ size, buffer, gutter, index: i, itemHeight: v.itemHeight });
        $column.onHeightChange((height) => {
          if (_height >= height) {
            return;
          }
          _height = height;
          bus.emit(Events.StateChange, { ..._state });
          // this.handleScroll(this.scrollValues);
        });
        $column.onCellUpdate((v) => {
          bus.emit(Events.CellUpdate, v);
        });
        $column.onStateChange(() => {
          bus.emit(Events.StateChange, { ..._state });
        });
        _$columns.push($column);
      }
      for (let i = 0; i < _$columns.length; i += 1) {
        _$columns[i].methods.update({ start: 0, end: _$columns[i].state.size });
      }
      _initialized = true;
    },
    unshiftItems(items: T[], opt: Partial<{ skipUpdateHeight: boolean }> = {}) {
      const $created_items = items.map((v) => {
        _index += 1;
        return WaterfallCellModel<T>({
          payload: v,
          height: (() => {
            const vv = v as any;
            if (vv.size?.height) {
              return vv.size.height;
            }
            if (vv.height) {
              return vv.height;
            }
            return 120;
          })(),
          uid: _index,
        });
      });
      for (let i = 0; i < $created_items.length; i += 1) {
        const item = $created_items[i];
        this.unshiftItemToColumn(item, opt);
      }
      // _items.push(...createdItems);
      //     this.state.pendingItems.push(...createdItems);
      methods.handleScroll(_scrollValues, { force: true });
      methods.refresh();
      return $created_items;
    },
    /**
     * 追加 items 到视图中
     * @param {unknown[]} 多条记录
     */
    appendItems(items: T[]) {
      const createdItems = items.map((v) => {
        _index += 1;
        return WaterfallCellModel<T>({
          payload: v,
          height: (() => {
            const vv = v as any;
            if (vv.size?.height) {
              return vv.size.height;
            }
            if (vv.height) {
              return vv.height;
            }
            return 120;
          })(),
          uid: _index,
        });
      });
      for (let i = 0; i < createdItems.length; i += 1) {
        const item = createdItems[i];
        this.placeItemToColumn(item);
      }
      // _items.push(...createdItems);
      //     this.state.pendingItems.push(...createdItems);
      methods.handleScroll(_scrollValues, { force: true });
      // console.log("[BIZ]Waterfall/waterfall - appendItems before StateChange", _state.columns[0].items);
      bus.emit(Events.StateChange, { ..._state });
      return createdItems;
    },
    /**
     * 将指定 item 放置到目前高度最小的 column
     */
    placeItemToColumn(item: WaterfallCellModel<T>) {
      if (_$columns.length === 1) {
        // console.log("[BIZ]Waterfall/waterfall - placeItemToColumn", _$items.length, item.state.payload);
        _$items.push(item);
        _$columns[0].methods.appendItem(item);
        return;
      }
      const columns = _$columns;
      const minHeight = Math.min.apply(
        null,
        columns.map((c) => c.state.height)
      );
      const lowestColumn = columns.find((c) => c.state.height === minHeight);
      if (!lowestColumn) {
        columns[0].methods.appendItem(item);
        return;
      }
      lowestColumn.methods.appendItem(item);
    },
    /** 往前面插入 cell */
    unshiftItemToColumn(item: WaterfallCellModel<T>, opt: Partial<{ skipUpdateHeight: boolean }> = {}) {
      if (_$columns.length === 1) {
        // console.log("[BIZ]Waterfall/waterfall - placeItemToColumn", _$items.length, item.state.payload);
        _$items.unshift(item);
        _$columns[0].methods.unshiftItem(item, opt);
        return;
      }
      const columns = _$columns;
      const minHeight = Math.min.apply(
        null,
        columns.map((c) => c.state.height)
      );
      const lowestColumn = columns.find((c) => c.state.height === minHeight);
      if (!lowestColumn) {
        columns[0].methods.unshiftItem(item, opt);
        return;
      }
      lowestColumn.methods.unshiftItem(item, opt);
    },
    /** 清空所有数据 */
    cleanColumns() {
      for (let i = 0; i < _$columns.length; i += 1) {
        _$columns[i].methods.clean();
      }
      _$items = [];
      _height = 0;
      bus.emit(Events.StateChange, { ..._state });
    },
    setClientHeight(v: number) {
      for (let i = 0; i < _$columns.length; i += 1) {
        _$columns[i].methods.setClientHeight(v);
      }
    },
    mapCellWithColumnIdxAndIdx(column_idx: number, cell_idx: number) {
      const $column = _$columns[column_idx];
      if ($column) {
        const $cell = $column.$cells[cell_idx];
        if ($cell) {
          return $cell;
        }
      }
      return null;
    },
    findCellWithPayload(finder: (v: T) => boolean) {
      return (
        _$items.find(($v) => {
          return finder($v.state.payload);
        })?.state.payload ?? null
      );
    },
    deleteCell(finder: (v: T) => boolean) {
      const idx = _$items.findIndex(($v) => {
        return finder($v.state.payload);
      });
      if (idx === -1) {
        return;
      }
      const $matched = _$items[idx];
      const column_idx = $matched.column_idx;
      const $column = _$columns[column_idx];
      if (!$column) {
        return;
      }
      $column.methods.deleteCell($matched);
      remove_arr_item(_$items, idx);
      methods.handleScroll({ scrollTop: _scrollValues.scrollTop }, { force: true });
    },
    resetRange() {
      for (let i = 0; i < _$columns.length; i += 1) {
        _$columns[i].methods.resetRange();
      }
    },
    isFinishScroll(v: number) {
      const cur = v;
      console.log("check has finish scroll", cur, _last_scroll_position);
      if (cur === _last_scroll_position) {
        console.log("滚动已停止");
      }
      _last_scroll_position = cur;
      _ticking = false;
    },
    handleScroll(values: { scrollTop: number; clientHeight?: number }, opt: Partial<{ force: boolean }> = {}) {
      if (values.scrollTop) {
        _scrollValues.scrollTop = values.scrollTop;
        // _last_scroll_position = values.scrollTop;
      }
      if (values.clientHeight) {
        _scrollValues.clientHeight = values.clientHeight;
      }
      // if (!_ticking) {
      //   window.requestAnimationFrame(() => {
      //     methods.isFinishScroll(values.scrollTop ?? 0);
      //   });
      //   _ticking = true;
      // }
      _scrolling = true;
      for (let i = 0; i < _$columns.length; i += 1) {
        if (opt.force) {
          _$columns[i].methods.handleScrollForce(values);
        } else {
          _$columns[i].methods.handleScroll(values);
        }
      }
    },
  };

  /** 共几列 */
  let _column = props.column ?? 2;
  /** 列宽度 */
  //   width = 0;
  /** 列间距 */
  let _gutter = props.gutter ?? 0;
  let _index = -1;
  /** 是否处于滚动中 */
  let _scrolling = false;
  let _last_scroll_position = 0;
  let _ticking = false;
  let _scrollValues = {
    scrollTop: 0,
    clientHeight: 0,
  };
  let _$items: WaterfallCellModel<T>[] = [];
  let _$columns: WaterfallColumnModel<T>[] = [];
  let _pendingItems = [];
  let _height = 0;
  /**
   * @type {{ items: WaterfallCellModel<T>[]; columns: WaterfallColumnModel<T>[] }}
   */
  //   state = {
  //     ...defaultListState,
  //   };
  let _initialized = false;

  const _state = {
    get items() {
      return _$items.map((v) => v.state);
    },
    get columns() {
      return _$columns.map((v) => v.state);
    },
    get height() {
      return _height;
    },
  };

  enum Events {
    StateChange,
    CellUpdate,
  }
  type TheTypesOfEvents = {
    [Events.CellUpdate]: {
      $item: WaterfallCellModel<T>;
    };
    [Events.StateChange]: typeof _state;
  };

  const bus = base<TheTypesOfEvents>();

  methods.initializeColumns(props);

  return {
    state: _state,
    methods,
    get $columns() {
      return _$columns;
    },
    get $items() {
      return _$items;
    },
    get gutter() {
      return _gutter;
    },
    onCellUpdate(handler: Handler<TheTypesOfEvents[Events.CellUpdate]>) {
      bus.on(Events.CellUpdate, handler);
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      bus.on(Events.StateChange, handler);
    },
  };
}

export type WaterfallModel<T extends Record<string, unknown>> = ReturnType<typeof WaterfallModel<T>>;
