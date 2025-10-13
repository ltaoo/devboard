import { createRoot, createSignal, createMemo, onCleanup, untrack, JSX, Accessor } from "solid-js";

export function Keyed<T extends readonly any[], U extends JSX.Element>(props: {
  each: T | undefined | null | false;
  by: (v: any) => any;
  children: (item: T[number], index: Accessor<number>) => U;
}): JSX.Element {
  const key = props.by;
  const mapFn = props.children;
  const disposers = new Map();
  let prev = new Map();
  onCleanup(() => {
    for (const disposer of disposers.values()) disposer();
  });

  // @ts-ignore
  return createMemo(() => {
    const list = props.each || [];
    const mapped: U[] = [];
    const newNodes = new Map();
    return untrack(() => {
      for (let i = 0; i < list.length; i++) {
        const listItem = list[i];
        const keyValue = key(listItem);
        const lookup = prev.get(keyValue);
        if (!lookup) {
          mapped[i] = createRoot((dispose) => {
            disposers.set(key, dispose);
            const index = createSignal(i);
            const item = createSignal(listItem);
            const result = mapFn(item[0], index[0]);
            newNodes.set(keyValue, { index, item, result });
            return result;
          });
        } else {
          lookup.index[1](i);
          lookup.item[1](listItem);
          mapped[i] = lookup.result;
          newNodes.set(keyValue, lookup);
        }
      }
      // disposal
      for (const old of prev.keys()) {
        if (!newNodes.has(old)) {
          try {
            disposers.get(old)();
          } catch (err) {
            // ...
          }
        }
      }
      prev = newNodes;
      return mapped;
    });
  });
}
