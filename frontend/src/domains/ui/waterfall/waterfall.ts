import { base, BaseDomain, Handler } from "@/domains/base";

import { WaterfallColumnModel } from "./column";
import { WaterfallCellModel } from "./cell";

const defaultListState = {
  items: [],
  columns: [],
  pendingItems: [],
  height: 0,
};

export function WaterfallModel<T>(props: { column?: number; size?: number; buffer?: number; gutter?: number }) {
  const methods = {
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
        console.log("[]before new ListColumnViewCore", size);
        const column = WaterfallColumnModel<T>({ size, buffer, gutter, index: i });
        column.onHeightChange((height) => {
          if (_height >= height) {
            return;
          }
          _height = height;
          bus.emit(Events.StateChange, { ..._state });
          // this.handleScroll(this.scrollValues);
        });
        column.onStateChange(() => {
          console.log("[BIZ]Waterfall/waterfall - handle column StateChange");
          bus.emit(Events.StateChange, { ..._state });
        });
        _$columns.push(column);
      }
      for (let i = 0; i < _$columns.length; i += 1) {
        _$columns[i].methods.update({ start: 0, end: _$columns[i].state.size });
      }
      _initialized = true;
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
          index: _index,
        });
      });
      for (let i = 0; i < createdItems.length; i += 1) {
        const item = createdItems[i];
        this.placeItemToColumn(item);
      }
      // _items.push(...createdItems);
      //     this.state.pendingItems.push(...createdItems);
      methods.handleScroll(_scrollValues);
      console.log("[BIZ]Waterfall/waterfall - appendItems before StateChange", _state.columns[0].items);
      bus.emit(Events.StateChange, {
        ..._state,
      });
    },
    /**
     * 将指定 item 放置到目前高度最小的 column
     */
    placeItemToColumn(item: WaterfallCellModel<T>) {
      if (_$columns.length === 1) {
        console.log("[BIZ]Waterfall/waterfall - placeItemToColumn", _$items.length, item.state.payload);
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
        // console.log('place to first column');
        columns[0].methods.appendItem(item);
        return;
      }
      // console.log(
      //     '现在放置',
      //     item.state.payload.title,
      //     '到最矮的 column 中',
      //     minHeight,
      //     columns.map((c) => c.height)
      // );
      lowestColumn.methods.appendItem(item);
    },
    /** 清空所有数据 */
    cleanColumns() {
      for (let i = 0; i < _$columns.length; i += 1) {
        _$columns[i].methods.clean();
      }
      _$items = [];
      //     this.state.pendingItems = [];
      _height = 0;
      bus.emit(Events.StateChange, { ..._state });
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
    handleScroll(values: { scrollTop: number; clientHeight?: number }) {
      if (values.scrollTop) {
        _scrollValues.scrollTop = values.scrollTop;
      }
      if (values.clientHeight) {
        _scrollValues.clientHeight = values.clientHeight;
      }
      for (let i = 0; i < _$columns.length; i += 1) {
        _$columns[i].methods.handleScroll(values);
      }
    },
  };

  /** 共几列 */
  let _column = props.column ?? 2;
  /** 列宽度 */
  //   width = 0;
  /** 列间距 */
  let _gutter = 0;
  let _index = -1;
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
  }
  type TheTypesOfEvents = {
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
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      bus.on(Events.StateChange, handler);
    },
  };
}

export type WaterfallModel<T> = ReturnType<typeof WaterfallModel<T>>;
