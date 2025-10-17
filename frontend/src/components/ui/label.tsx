import { JSX } from "solid-js/jsx-runtime";

export const Label = (props: JSX.HTMLAttributes<HTMLDivElement> & JSX.AriaAttributes) => (
  <div ref={props.ref} class={props.class} classList={props.classList}>
    {props.children}
  </div>
);
