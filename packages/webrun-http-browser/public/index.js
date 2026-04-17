import { SwHttpAdapter } from "../dist/sw.js";

/**
 * Factory for a same-origin `SwHttpAdapter` rooted at this directory.
 * Apps pass the `key` they want to expose and any per-handler options.
 */
export function createLocalAdapter(options) {
  return new SwHttpAdapter({
    serviceWorkerUrl: `${new URL("./sw-worker.js", import.meta.url)}`,
    ...options,
  });
}
