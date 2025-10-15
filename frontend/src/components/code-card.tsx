import { onCleanup, onMount } from "solid-js";

import { initLineNumberPlugin } from "./code-card-util";

const MountedMapWithId: Record<string, boolean> = {};

export function CodeCard(props: { id: string | number; language?: string | null; linenumber?: boolean; code: string }) {
  let $code: HTMLDivElement | undefined;

  // onMount(() => {
  //   console.log("[COMPONENT]code-card - Mount", props.language);
  // });
  // onCleanup(() => {
  //   console.log("[COMPONENT]code-card - CleanUp", props.language);
  // });
  // console.log("[COMPONENT]code-card - load language", props.language, $code);
  // import "highlight.js/styles/github.css";
  if (!MountedMapWithId[props.id]) {
    import("highlight.js/styles/base16/solarized-dark.css");
    import("highlight.js/lib/core").then(async (hljs) => {
      if (!props.language) {
        return;
      }
      const language = props.language.toLowerCase();
      // console.log("load language", language, $code);
      if (!$code) {
        return;
      }
      try {
        if (language === "go") {
          const { default: language_package } = await import("highlight.js/lib/languages/go");
          hljs.default.registerLanguage(language, language_package);
        }
        if (language === "sql") {
          const { default: language_package } = await import("highlight.js/lib/languages/sql");
          hljs.default.registerLanguage(language, language_package);
        }
        if (language === "json") {
          const { default: language_package } = await import("highlight.js/lib/languages/json");
          hljs.default.registerLanguage(language, language_package);
        }
        if (language === "python") {
          const { default: language_package } = await import("highlight.js/lib/languages/python");
          hljs.default.registerLanguage(language, language_package);
        }
        if (language === "rust") {
          const { default: language_package } = await import("highlight.js/lib/languages/rust");
          hljs.default.registerLanguage(language, language_package);
        }
        if (language === "javascript") {
          const { default: language_package } = await import("highlight.js/lib/languages/javascript");
          hljs.default.registerLanguage(language, language_package);
        }
        if (language === "typescript") {
          const { default: language_package } = await import("highlight.js/lib/languages/typescript");
          hljs.default.registerLanguage(language, language_package);
        }
        //       if (language === "react") {
        //         const { default: language_package } = await import("highlight.js/lib/languages/react");
        //         hljs.default.registerLanguage(language, language_package);
        //       }
        //       if (language === "vue") {
        //         const { default: language_package } = await import("highlight.js/lib/languages/vue");
        //         hljs.default.registerLanguage(language, language_package);
        //       }
      } catch (err) {
        // ...
        console.log("load language", language, "failed", err);
      }
      hljs.default.highlightElement($code);
      MountedMapWithId[props.id] = true;
      // @ts-ignore
      window.hljs = hljs.default;
      if (props.linenumber) {
        initLineNumberPlugin(window, document);
        // @ts-ignore
        if (typeof hljs.default.initLineNumbersOnLoad === "function") {
          // @ts-ignore
          hljs.default.initLineNumbersOnLoad();
        }
      }
    });
  }

  return (
    <pre class="w-full h-full">
      <code ref={$code} class={"w-full h-full font-[12px] hljs " + props.language}>
        {props.code}
      </code>
    </pre>
  );
}
