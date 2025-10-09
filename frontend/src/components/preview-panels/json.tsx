import { createSignal } from "solid-js";

import { CodeCard } from "@/components/code-card";

export function JSONContentPreview(props: { text: string }) {
  const [text, setText] = createSignal(JSON.stringify(JSON.parse(props.text), null, 4));

  return (
    <div>
      <CodeCard language="JSON" linenumber code={text()} />
    </div>
  );
}
