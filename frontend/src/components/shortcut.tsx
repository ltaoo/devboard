/**
 * @file 快捷键
 */
import { For } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

export function ShortcutKey(
  props: {
    keys: string[];
    separator?: string;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "primary" | "secondary" | "mac";
  } & JSX.HTMLAttributes<HTMLDivElement>
) {
  const { keys, separator = "+", size = "md", variant = "default" } = props;

  const sizeClasses = {
    sm: "min-w-[28px] h-6 px-1.5 text-xs",
    md: "min-w-[36px] h-8 px-2 text-sm",
    lg: "min-w-[44px] h-10 px-3 text-base",
  };

  const variantClasses = {
    default: "text-gray-700 bg-gray-50 border-gray-200",
    primary: "text-blue-700 bg-blue-50 border-blue-200",
    secondary: "text-purple-700 bg-purple-50 border-purple-200",
    mac: "text-gray-800 bg-gradient-to-b from-gray-100 to-gray-200 border-gray-300",
  };

  return (
    <div
      classList={{
        "inline-flex items-center space-x-1": true,
        [props.class ?? ""]: true,
        ...props.classList,
      }}
    >
      <For each={keys}>
        {(key, idx) => {
          return (
            <>
              <kbd
                classList={{
                  "inline-flex items-center justify-center font-semibold border rounded-lg shadow-sm transition-all":
                    true,
                  "hover:shadow-md": true,
                  [sizeClasses[size]]: true,
                  [variantClasses[variant]]: true,
                }}
              >
                {key}
              </kbd>
              {idx() < keys.length - 1 && <span class="text-gray-400 text-sm">{separator}</span>}
            </>
          );
        }}
      </For>
    </div>
  );
}
