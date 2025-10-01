export function CodeCard(props: { language: string; code: string }) {
  let $code: HTMLDivElement | undefined;

  // import "highlight.js/styles/github.css";
  import("highlight.js/styles/base16/solarized-dark.css");
  import("highlight.js/lib/core").then(async (hljs) => {
    const language = props.language.toLowerCase();
    console.log("load language", language, $code);
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
  });

  return (
    <pre class="w-full h-full">
      <code ref={$code} class="w-full h-full">{props.code}</code>
    </pre>
  );
}
