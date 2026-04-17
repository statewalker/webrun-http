// Same-origin HTTP dispatcher ServiceWorker.
// Must be served from the same directory as the app pages so its scope
// (`./`) covers them.
importScripts("../dist/sw-worker.js");
