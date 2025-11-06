import { Result } from "@/domains/result";

import { ClipboardModel } from "./index";

export function connect(vm: ClipboardModel) {
  const supported = navigator.clipboard && typeof navigator.clipboard.readText === "function";

  function readTextFallback(): Promise<Result<string>> {
    return new Promise((resolve) => {
      // 创建隐藏的textarea
      const textarea = document.createElement("textarea");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.focus();

      // 添加事件监听器
      const pasteHandler = (e: ClipboardEvent) => {
        try {
          e.stopPropagation();
          const pastedText = e.clipboardData?.getData("text");
          if (pastedText) {
            resolve(Result.Ok(pastedText));
            return;
          }
          resolve(Result.Err("读取内容失败"));
        } catch (error) {
          resolve(Result.Err(error as Error));
        } finally {
          cleanup();
        }
      };

      const cleanup = () => {
        textarea.removeEventListener("paste", pasteHandler);
        document.body.removeChild(textarea);
      };

      textarea.addEventListener("paste", pasteHandler);

      // 尝试执行粘贴命令
      try {
        if (!document.execCommand("paste")) {
          resolve(Result.Err(new Error("execCommand失败")));
        }
      } catch (err) {
        resolve(Result.Err(err as Error));
      }
    });
  }

  vm.methods.readText = async function (): Promise<Result<string>> {
    if (supported) {
      try {
        const text = await navigator.clipboard.readText();
        return Result.Ok(text);
      } catch (err) {
        // console.warn("Clipboard API 失败，尝试备用方法:", err);
        return readTextFallback();
      }
    }
    return readTextFallback();
  };
  vm.methods.writeText = function (text: string) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  };
}
