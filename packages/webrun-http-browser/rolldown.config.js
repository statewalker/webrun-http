import { defineConfig } from "rolldown";

// All bundles are self-contained so the ESM outputs work straight from
// `<script type="module">` in the browser (no import map) and the IIFE
// outputs work through `importScripts(...)` in classic ServiceWorkers.
//
// ESM outputs sit at `dist/*.js` so `import.meta.url` inside the bundle
// resolves siblings like `../public-relay/relay.html` the same way the
// pre-bundled source would.
export default defineConfig([
  {
    input: {
      index: "src/index.ts",
      sw: "src/sw.ts",
    },
    output: {
      dir: "dist",
      format: "esm",
      entryFileNames: "[name].js",
      chunkFileNames: "_chunks/[name]-[hash].js",
    },
    treeshake: true,
  },
  ...["relay-sw", "sw-worker"].map((name) => ({
    input: `src/${name}.ts`,
    output: {
      file: `dist/${name}.js`,
      format: "iife",
    },
    transform: {
      // IIFE has no `import.meta` — in a SW `self.location.href` is the
      // URL of the SW script, which is what the `new URL(..., base)` calls want.
      define: { "import.meta.url": "self.location.href" },
    },
    treeshake: true,
  })),
]);
