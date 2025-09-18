import { createSignal, onMount, Show } from "solid-js";

import { FileService } from "~/index";

export function LocalImage(props: { url: string }) {
  const [url, setURL] = createSignal("");

  onMount(async () => {
    const r = await FileService.URL(props.url);
    setURL(r);
  });

  return (
    <Show when={url()}>
      <img class="w-full h-full rounded-md object-cover" width="100%" src={url()} />
    </Show>
  );
}
