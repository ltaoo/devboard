import { onMount } from "solid-js";
import { Browser, Dialogs, Events } from "@wailsio/runtime";

export function HTMLCard(props: { html: string; onClickURL?: (event: { url: string }) => void }) {
  //   function handleClick() {}
  let $container: HTMLDivElement | undefined;

  onMount(() => {
    if (!$container) {
      return;
    }
    //     const links = $container.querySelectorAll("a");
    //     links.forEach((link) => {
    //       link.addEventListener("click", (e) => {
    //         e.preventDefault();
    //         console.log("[2]Link clicked:");
    //       });
    //     });
    $container.addEventListener("click", async (e) => {
      console.log("[2]Link clicked:", e.target);
      let target = e.target;
      if (target === null) {
        return;
      }
      if (target instanceof Document) {
        return;
      }
      let matched = false;
      while (target) {
        const t = target as HTMLElement;
        if (t.tagName === "A") {
          matched = true;
          break;
        }
        target = t.parentNode;
      }
      if (!matched) {
        return;
      }
      const t = target as HTMLElement;
      e.preventDefault();
      const href = t.getAttribute("href");
      if (!href) {
        return;
      }
      //       props.onClickURL?.({ url: href });
      const r = await Dialogs.Question({
        Title: "Open URL",
        Message: "Are you sure you want to open the link " + href + " ?",
        Buttons: [
          {
            Label: "Cancel",
            IsCancel: true,
          },
          {
            Label: "Open",
            IsDefault: true,
          },
        ],
      });
      if (r !== "Open") {
        return;
      }
      Browser.OpenURL(href);
    });
  });

  return <div ref={$container} innerHTML={props.html}></div>;
}
