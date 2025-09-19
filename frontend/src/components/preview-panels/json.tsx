import { createSignal } from "solid-js";

export function JSONPreviewPanelView(props: { text: string }) {
  const [text, setText] = createSignal(JSON.stringify(JSON.parse(props.text), null, 4));

  return (
    <div>
      <pre>{text()}</pre>
    </div>
  );
}
