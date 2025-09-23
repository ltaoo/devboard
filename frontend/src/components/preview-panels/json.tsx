import { createSignal } from "solid-js";

export function JSONContentPreview(props: { text: string }) {
  const [text, setText] = createSignal(JSON.stringify(JSON.parse(props.text), null, 4));

  return (
    <div>
      <pre>{text()}</pre>
    </div>
  );
}
