import { defineConfig } from "rolldown";

// Single self-contained ESM bundle at dist/index.js.
export default defineConfig({
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "esm",
  },
  treeshake: true,
});
