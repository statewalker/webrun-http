// The relay ServiceWorker.
// It MUST be served from this directory so its scope (`./`) covers
// relay.html and any in-browser `fetch()` calls the apps route through it.
importScripts("../dist/relay-sw.js");
