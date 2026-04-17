import { defineConfig } from "rolldown";

// Every output is a single, fully self-contained file:
// - ESM bundles (index.js, sw.js) can be loaded from `<script type="module">`
//   with no import map, no bundler, and no sibling chunk files.
// - IIFE bundles (relay-sw.js, sw-worker.js) can be loaded from a classic
//   `importScripts(...)` loader script.
//
// To get "no chunk splitting" with multiple entries, each entry gets its
// own rolldown config. Duplicated code across bundles is accepted in
// exchange for truly standalone output.

const entries = [
  { name: "index", input: "src/index.ts", format: "esm" },
  { name: "sw", input: "src/sw.ts", format: "esm" },
  { name: "relay-sw", input: "src/relay-sw.ts", format: "iife" },
  { name: "sw-worker", input: "src/sw-worker.ts", format: "iife" },
];

export default defineConfig(
  entries.map(({ name, input, format }) => ({
    input,
    output: { file: `dist/${name}.js`, format },
    transform:
      format === "iife"
        ? {
            // IIFE has no `import.meta`; inside a SW `self.location.href` is
            // the URL of the SW script — same base the page-side code uses.
            define: { "import.meta.url": "self.location.href" },
          }
        : undefined,
    treeshake: true,
  })),
);
