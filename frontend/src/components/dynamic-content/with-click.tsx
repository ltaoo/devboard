import { JSX, createSignal } from "solid-js";

export function DynamicContentWithClick(
  props: {
    options: { content: null | JSX.Element }[];
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const [step, setStep] = createSignal(0);

  return (
    <div
      class={props.class}
      onClick={(event) => {
        setStep((prev) => prev + 1);
        setTimeout(() => {
          setStep((prev) => prev - 1);
        }, 3000);
      }}
    >
      {(() => {
        const matched = props.options[step()];
        if (!matched) {
          return null;
        }
        return matched.content;
      })()}
    </div>
  );
}
