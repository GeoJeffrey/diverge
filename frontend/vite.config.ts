import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { isDemoBuild, shellHtml } from "./prerender-shell";

/**
 * Writes the static top of the key pages into index.html so text paints before the JS runs, and
 * preloads the two main (latin) font files so text doesn't re-wrap when they arrive late.
 */
function prerenderShell(isDemo: boolean): Plugin {
  return {
    name: "diverge-prerender-shell",
    transformIndexHtml(html, ctx) {
      const fonts = Object.keys(ctx.bundle ?? {}).filter((f) =>
        /(inter-latin-opsz-normal|jetbrains-mono-latin-wght-normal)-[\w-]+\.woff2$/.test(f),
      );
      return {
        html: html.replace('<div id="root"></div>', shellHtml(isDemo)),
        tags: fonts.map((f) => ({
          tag: "link",
          attrs: { rel: "preload", href: `/${f}`, as: "font", type: "font/woff2", crossorigin: "" },
          injectTo: "head" as const,
        })),
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  return {
    plugins: [react(), tailwindcss(), prerenderShell(isDemoBuild(env.VITE_API_BASE_URL))],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
    },
  };
});
