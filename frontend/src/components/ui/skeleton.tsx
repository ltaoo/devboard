import { JSX } from "solid-js/jsx-runtime";

function Skeleton(props: {} & JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      classList={{
        "animate-pulse w-full h-full rounded-md bg-w-bg-5": true,
        [props.class ?? ""]: true,
      }}
    />
  );
}

export { Skeleton };
