import { JSX } from "solid-js/jsx-runtime";

export function Flex(
  props: {
    items?: "center";
    justify?: "center" | "between";
    gap?: string;
    dire?: "col";
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const { class: className, ...rest } = props;
  return (
    <div
      {...rest}
      class={className}
      classList={{
        ...props.classList,
        flex: true,
        [props.justify ? `justify-${props.justify}` : ""]: true,
        [props.items ? `items-${props.items}` : ""]: true,
        [props.gap ? `gap-${props.gap}` : ""]: true,
        [props.dire ? `flex-${props.dire}` : ""]: true,
        [props.class ?? ""]: true,
      }}
    >
      {props.children}
    </div>
  );
}
