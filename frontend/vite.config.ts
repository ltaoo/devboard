import path from "path";
import fs from "fs";

import { UserConfigExport, defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
// import { barrel } from "vite-plugin-barrel";
import { createLucideSolidImportOptimizer } from "./plugins/lucide-solid";

const pkg = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, "./package.json"), "utf-8"));
  } catch (err) {
    return null;
  }
})();

const config = defineConfig(({ mode }) => {
  return {
    plugins: [solidPlugin(), createLucideSolidImportOptimizer()],
    resolve: {
      alias: {
        // "lucide-solid": require.resolve("lucide-solid").replace("cjs", "esm"),
        "@": path.resolve(__dirname, "./src"),
        "~": path.resolve(__dirname, "./bindings/devboard/internal/service"),
      },
    },
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
    define: {
      "process.global.__VERSION__": JSON.stringify(pkg ? pkg.version : "unknown"),
    },
    build: {
      target: "esnext",
      rollupOptions: {
        output: {
          manualChunks(filepath) {
            // if (filepath.includes("hls.js")) {
            //   return "hls";
            // }
            if (filepath.includes("node_modules") && !filepath.includes("hls")) {
              return "vendor";
            }
          },
        },
      },
    },
  };
});

export default config;
