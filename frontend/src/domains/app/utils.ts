export function listenMultiEvent(events: (() => void)[]) {
  return () => {
    for (let i = 0; i < events.length; i += 1) {
      const cancel = events[i];
      cancel();
    }
  };
}
