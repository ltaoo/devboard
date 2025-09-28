import { base, BaseDomain, Handler } from "@/domains/base";
import { toFixed } from "@/utils";

export function WaterfallCellModel<T extends Record<string, unknown>>(props: {
  uid: number;
  height: number;
  payload: T;
}) {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    /**
     * @param {object} size
     * @param {number} size.width
     * @param {number} size.height
     */
    load(size: { width: number; height: number }) {
      if (_loaded) {
        return;
      }
      const { width, height } = size;
      if (_height !== height) {
        bus.emit(Events.HeightChange, [_height, toFixed(height - _height, 0)]);
      }
      _height = height;
      _loaded = true;
      bus.emit(Events.Loaded, { width, height });
      methods.refresh();
    },
    getOffsetTop() {
      return 0;
    },
    exposure() {
      _visible = true;
      bus.emit(Events.Visible);
    },
    setIndex(idx: number) {
      _idx = idx;
    },
    setColumnIdx(idx: number) {
      _column_idx = idx;
    },
    setTopWithDifference(difference: number) {
      if (difference === 0) {
        return;
      }
      const original_top = _top;
      _top = toFixed(_top + difference, 0);
      bus.emit(Events.TopChange, [original_top, difference]);
      methods.refresh();
    },
    setTop(top: number) {
      if (_top === top) {
        return;
      }
      _top = top;
      methods.refresh();
    },
    setHeight(height: number) {
      if (_height === height) {
        return;
      }
      const original_height = _height;
      _height == height;
      bus.emit(Events.HeightChange, [original_height, original_height - height]);
      methods.refresh();
    },
    setPosition(position: { x: number; y: number }) {
      _position = position;
      bus.emit(Events.StateChange, { ..._state });
    },
    updateHeight(height: number) {
      if (_height === height) {
        return;
      }
      console.log("before matched.updateHeight", _payload, _height, height);
      const cur = _height;
      _height = height;
      bus.emit(Events.HeightChange, [height, toFixed(height - cur, 0)]);
    },
  };

  let _payload = props.payload;
  let _top = 0;
  let _width = 0;
  let _height = props.height;
  let _loaded = false;
  /** 该卡片超过 50% 的内容进入页面 */
  let _visible = false;
  /** 其实是 id */
  let _idx = props.uid;
  let _id = props.payload["id"] ?? _idx;
  let _column_idx = 0;
  /** 该 item 定位 */
  let _position = { x: 0, y: 0 };

  const _state = {
    get id() {
      return _id;
    },
    get idx() {
      return _idx;
    },
    get position() {
      return _position;
    },
    get top() {
      return _top;
    },
    get size() {
      return {
        get width() {
          return _width;
        },
        get height() {
          return _height;
        },
      };
    },
    get width() {
      return _width;
    },
    get height() {
      return _height;
    },
    get payload() {
      return _payload;
    },
  };

  enum Events {
    StateChange,
    Loaded,
    HeightChange,
    TopChange,
    Visible,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Loaded]: {
      width: number;
      height: number;
    };
    [Events.TopChange]: [number, number];
    [Events.HeightChange]: [number, number];
    [Events.Visible]: void;
  };

  const bus = base<TheTypesOfEvents>();
  // let _id = props.payload["id"] ?? bus.uid();

  return {
    state: _state,
    methods,
    get id() {
      return _id;
    },
    get idx() {
      return _idx;
    },
    get column_idx() {
      return _column_idx;
    },
    get size() {
      return _state.size;
    },
    get height() {
      return _state.height;
    },
    /** 监听卡片高度改变 */
    onHeightChange(handler: Handler<TheTypesOfEvents[Events.HeightChange]>) {
      bus.on(Events.HeightChange, handler);
    },
    onTopChange(handler: Handler<TheTypesOfEvents[Events.TopChange]>) {
      bus.on(Events.TopChange, handler);
    },
    /** 监听卡片是否加载好（能拿到宽高） */
    onLoad(handler: Handler<TheTypesOfEvents[Events.Loaded]>) {
      bus.on(Events.Loaded, handler);
    },
    /**
     * 监听卡片是否出现在可视区域（50% 内容出现在页面）
     * 已经触发过，小于 50% 后又大于 50% 不会重复触发
     */
    onExposure(handler: Handler<TheTypesOfEvents[Events.Visible]>) {
      bus.on(Events.Visible, handler);
    },
    /** 监听状态值改变 */
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      bus.on(Events.StateChange, handler);
    },
  };
}

export type WaterfallCellModel<T extends Record<string, unknown>> = ReturnType<typeof WaterfallCellModel<T>>;
