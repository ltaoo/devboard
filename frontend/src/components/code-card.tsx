export function CodeCard(props: { language: string; code: string }) {
  let $code: HTMLDivElement | undefined;

  // import "highlight.js/styles/github.css";
  import("highlight.js/styles/base16/solarized-dark.css");
  import("highlight.js/lib/core").then(async (hljs) => {
    if (!$code) {
      return;
    }
    const language = props.language.toLowerCase();
    try {
      if (language === "go") {
        const { default: language_package } = await import("highlight.js/lib/languages/go");
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
    <pre>
      <code ref={$code}>{props.code}</code>
    </pre>
  );
}
