import { createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize,
  Download,
  Loader,
  Pin,
  PinOff,
} from "lucide-solid";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { useViewModel } from "@/hooks";
import { ButtonCore, ScrollViewCore } from "@/domains/ui";
import { Button } from "@/components/ui/button";
import { downloadPasteContent } from "@/biz/paste/service";

function ImageContentPreviewModel(props: { url: string; id?: string }) {
  let _scale = 1;
  let _rotate = 0;
  let _translateX = 0;
  let _translateY = 0;

  const methods = {
    zoomIn() {
      _scale = Number((_scale + 0.2).toFixed(1));
      methods.refresh();
    },
    zoomOut() {
      _scale = Math.max(0.1, Number((_scale - 0.2).toFixed(1)));
      methods.refresh();
    },
    rotateRight() {
      _rotate = (_rotate + 90) % 360;
      methods.refresh();
    },
    rotateLeft() {
      _rotate = (_rotate - 90) % 360;
      methods.refresh();
    },
    reset() {
      _scale = 1;
      _rotate = 0;
      _translateX = 0;
      _translateY = 0;
      methods.refresh();
    },
    pan(dx: number, dy: number) {
      _translateX += dx;
      _translateY += dy;
      methods.refresh();
    },
    async download() {
      if (!props.id) return;
      ui.$btn_download.setLoading(true);
      await downloadPasteContent({ paste_event_id: props.id });
      ui.$btn_download.setLoading(false);
    },
    async ocr() {
      ui.$btn_ocr.setLoading(true);
      const body = (() => {
        if (props.id) {
          return { paste_event_id: props.id };
        }
        return { image_base64: _state.url };
      })();
      let ok = false;
      let data: any = null;
      try {
        const resp = await fetch("http://127.0.0.1:8389/api/ocr/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await resp.json();
        ok = json.code === 200;
        data = json.data;
      } catch (err) {
        ui.$btn_ocr.setLoading(false);
        const e = err as Error;
        bus.emit(Events.Error, new BizError([e.message]));
        return;
      }
      ui.$btn_ocr.setLoading(false);
      if (!ok) {
        bus.emit(Events.Error, new BizError(["OCR 请求失败"]));
        return;
      }
      const text = JSON.stringify(data);
      _ocr_text = text;
      methods.refresh();
    },
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
    $btn_zoom_in: new ButtonCore({ onClick: methods.zoomIn }),
    $btn_zoom_out: new ButtonCore({ onClick: methods.zoomOut }),
    $btn_rotate_left: new ButtonCore({ onClick: methods.rotateLeft }),
    $btn_rotate_right: new ButtonCore({ onClick: methods.rotateRight }),
    $btn_reset: new ButtonCore({ onClick: methods.reset }),
    $btn_download: new ButtonCore({ onClick: methods.download }),
    $btn_ocr: new ButtonCore({ onClick: methods.ocr }),
  };

  let _url = props.url;
  let _ocr_text = "";
  let _state = {
    get url() {
      return _url;
    },
    get scale() {
      return _scale;
    },
    get rotate() {
      return _rotate;
    },
    get translateX() {
      return _translateX;
    },
    get translateY() {
      return _translateY;
    },
    get ocr_text() {
      return _ocr_text;
    },
  };
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
    ready() { },
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

export function ImageContentPreview(props: { url: string; id?: string }) {
  const [state, vm] = useViewModel(ImageContentPreviewModel, [props]);

  let containerRef: HTMLDivElement | undefined;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        vm.methods.zoomIn();
      } else {
        vm.methods.zoomOut();
      }
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (state().scale > 1) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      vm.methods.pan(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  onMount(() => {
    if (containerRef) {
      containerRef.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
  });

  onCleanup(() => {
    if (containerRef) {
      containerRef.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
  });

  return (
    <div ref={containerRef} class="absolute inset-0 flex flex-col select-none overflow-hidden">
      <div class="flex items-center justify-center p-2 space-x-1 bg-w-bg-3/80 backdrop-blur-md z-10 border-b border-w-bg-4">
        <Button variant="ghost" size="sm" store={vm.ui.$btn_zoom_in} icon={<ZoomIn class="w-4 h-4" />} />
        <Button variant="ghost" size="sm" store={vm.ui.$btn_zoom_out} icon={<ZoomOut class="w-4 h-4" />} />
        <Button variant="ghost" size="sm" store={vm.ui.$btn_reset} icon={<Maximize class="w-4 h-4" />} />
        <div class="w-[1px] h-4 bg-w-bg-4 mx-1" />
        <Button variant="ghost" size="sm" store={vm.ui.$btn_rotate_left} icon={<RotateCcw class="w-4 h-4" />} />
        <Button variant="ghost" size="sm" store={vm.ui.$btn_rotate_right} icon={<RotateCw class="w-4 h-4" />} />
        <div class="w-[1px] h-4 bg-w-bg-4 mx-1" />
        <Button variant="ghost" size="sm" store={vm.ui.$btn_ocr}>
          OCR
        </Button>
        <Show when={props.id}>
          <div class="w-[1px] h-4 bg-w-bg-4 mx-1" />
          <Button variant="ghost" size="sm" store={vm.ui.$btn_download} icon={<Download class="w-4 h-4" />} />
        </Show>
      </div>
      <div
        class="relative flex-1 cursor-move"
        onMouseDown={onMouseDown}
      >
        <img
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ease-out max-w-[90%] max-h-[90%] object-contain pointer-events-none shadow-lg"
          style={{
            transform: `translate(calc(-50% + ${state().translateX}px), calc(-50% + ${state().translateY}px)) scale(${state().scale}) rotate(${state().rotate}deg)`,
          }}
          src={state().url}
        />
        <Show when={state().ocr_text}>
          <div class="absolute left-2 right-2 bottom-2 max-h-[40%] overflow-auto bg-w-bg-3/80 backdrop-blur-md rounded-md p-2 text-xs whitespace-pre-wrap">
            {state().ocr_text}
          </div>
        </Show>
      </div>
    </div>
  );
}
