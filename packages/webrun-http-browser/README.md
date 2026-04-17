# @statewalker/webrun-http-browser

ServiceWorker-based HTTP server for browsers. You write ordinary
`(Request) ⇒ Response` handlers in JavaScript; a ServiceWorker intercepts
same-origin `fetch()` calls and routes them to your handlers — no network
round-trip, no external server, no bundler tricks required.

Two modes, picked by how the SW is hosted:

- **Same-origin** (`@statewalker/webrun-http-browser/sw`) — your app
  registers its own SW and mounts handlers next to the page.
- **Relay** (default entry) — a SW running at a shared relay origin
  (CDN / unpkg / your own host) serves requests for any page that embeds
  a hidden relay iframe. Cross-origin friendly.

## Why it exists

The browser already has everything needed to be an HTTP server: `Request`,
`Response`, `ReadableStream`, `ServiceWorker`. Two things are missing from
the raw platform APIs, and this package fills them:

1. **Plumbing for same-origin SW dispatch.** Browsers let a SW intercept
   `fetch` events, but you still have to build URL routing, MessageChannel
   wiring between the page and the SW, and recovery after SW restarts.
2. **A way to use a SW from a page that isn't on the SW's origin.** The
   relay mode lets *any* page (Observable, notebooks, a `file://` demo,
   unpkg, a third-party host) share a SW hosted somewhere else. The page
   never registers a SW of its own — it just embeds a hidden iframe.

Combining both modes means the same handler code works in an app you
control *and* in an embed you don't.

## How to use

```sh
npm install @statewalker/webrun-http-browser
```

| Subpath | Purpose |
| --- | --- |
| `@statewalker/webrun-http-browser` | Page-side relay API: `newRemoteRelayChannel`, `initHttpService`, `callHttpService`, `splitServiceUrl`, plus re-exports from `@statewalker/webrun-http` (`HttpError`, stubs, stream helpers) |
| `@statewalker/webrun-http-browser/sw` | Same-origin adapter classes: `SwHttpAdapter` (page), `SwHttpDispatcher` (SW), `startHttpDispatcher` bootstrap |
| `@statewalker/webrun-http-browser/relay-sw` | IIFE bundle of the relay SW runtime — load via `importScripts` from a loader script in your relay origin |
| `@statewalker/webrun-http-browser/sw-worker` | IIFE bundle of the same-origin SW runtime — ditto, for same-origin apps |

## Examples

### Relay mode — cross-origin

Your page ↔ hidden relay iframe ↔ relay ServiceWorker. The relay SW claims
URLs shaped `<relay-origin>/~<service-key>/…` and forwards each request to
whichever page registered that `key`.

```ts
import {
  newRemoteRelayChannel,
  initHttpService,
  callHttpService,
} from "@statewalker/webrun-http-browser";

// 1. Embed the relay iframe and open a MessagePort into its SW.
const connection = await newRemoteRelayChannel({
  url: new URL("https://my-relay.example/public-relay/relay.html"),
});

// 2. Register a handler for service "FS".
const baseUrl = `${connection.baseUrl}~FS`;
await initHttpService(
  async (request) =>
    new Response(`Hello ${new URL(request.url).pathname}`),
  { key: "FS", port: connection.port },
);

// 3a. Any browser tab loading the service URL now hits your handler:
await fetch(`${baseUrl}/anything`);

// 3b. …or call it directly through the same port, bypassing `fetch`
//     (useful when the caller isn't on the relay origin):
const res = await callHttpService(
  new Request(`${baseUrl}/anything`),
  { key: "FS", port: connection.port },
);
```

[`demo/demo-1.html`](./demo/demo-1.html) wires this to a Hono router
serving a mini site; [`demo/demo-2.html`](./demo/demo-2.html) pipes a
local-disk folder (File System Access API) through it.

### Same-origin mode

Your page registers its own SW, handlers are local to the page:

```ts
import { SwHttpAdapter } from "@statewalker/webrun-http-browser/sw";

const KEY = "demo"; // also the first URL segment the SW routes here
const adapter = new SwHttpAdapter({
  key: KEY,
  serviceWorkerUrl: new URL("./sw-worker.js", import.meta.url).toString(),
});
await adapter.start();

const { baseUrl } = await adapter.register(`${KEY}/api/`, async (request) => {
  return new Response(JSON.stringify({ now: Date.now() }), {
    headers: { "Content-Type": "application/json" },
  });
});

// fetch(`${baseUrl}anything`) is intercepted by the SW.
```

The SW script itself ships as a pre-built IIFE bundle. Put a tiny loader
next to your app pages so the SW's default scope covers them:

```js
// public/sw-worker.js — served next to your app pages.
importScripts(
  "/path/to/node_modules/@statewalker/webrun-http-browser/dist/sw-worker.js",
);
```

The working example lives in [`public/`](./public).

### Running the bundled examples

```sh
pnpm run example:same-origin   # public/index.html    — sw/ mode demo
pnpm run example:relay-site    # demo/demo-1.html     — relay + Hono dynamic site
pnpm run example:relay-files   # demo/demo-2.html     — relay + local-disk file server
pnpm run serve                 # just a static server on :5173 (no auto-open)
```

Each `example:*` script builds first, starts a static server on `:5173`,
then opens the target page in the default browser. ServiceWorkers only
register over `http://localhost` or HTTPS, so always visit through
`http://localhost:5173/…` — `file://` won't work.

## Internals

### Source layout

```
src/
├── core/                          ┐
│   ├── data-calls.ts              │  Transport primitives: one-shot
│   ├── data-channels.ts           │  `callChannel` / `handleChannelCalls`,
│   ├── data-send-recieve.ts       │  streaming `sendStream` / `handleStreams`
│   ├── errors.ts                  │  with backpressure over MessagePort,
│   ├── message-target.ts          │  plus inlined `newRegistry`, and
│   ├── new-async-generator.ts     │  `newAsyncGenerator` (queue + cleanup
│   └── registry.ts                │  generator used for back-pressure).
│                                  ┘
├── http/                          ┐
│   ├── http-send-recieve.ts       │  Browser-specific HTTP transport:
│   │                              │  `handleHttpRequests` /
│   │                              │  `sendHttpRequest` over `MessageTarget`s.
│   └── index.ts                   │  Re-exports `@statewalker/webrun-http`
│                                  ┘  (HttpError, stubs, stream helpers).
├── sw/                            ┐
│   ├── sw-dispatcher.ts           │  Same-origin mode:
│   │                              │  `SwPortHandler` (page) /
│   │                              │  `SwPortDispatcher` (SW side,
│   │                              │  IndexedDB-persisted client index).
│   ├── http-sw-dispatcher.ts      │  `SwHttpAdapter` /
│   │                              │  `SwHttpDispatcher` /
│   └── index.ts                   │  `startHttpDispatcher`.
│                                  ┘
├── relay/                         ┐
│   ├── index.ts                   │  Relay mode page-side:
│   │                              │  `newRemoteRelayChannel`,
│   │                              │  `initHttpService`,
│   │                              │  `callHttpService`,
│   │                              │  `getRelayWindowMessageHandler`.
│   ├── index-sw.ts                │  `startRelayServiceWorker` — the SW
│   │                              │  side (registry keyed by service key).
│   └── split-service-url.ts       │  `<base>/~<key>/<path>` parser.
│                                  ┘
├── index.ts                       — public entry: core + http + relay.
├── sw.ts                          — `./sw` subpath entry.
├── relay-sw.ts                    — relay SW bootstrap (IIFE target).
└── sw-worker.ts                   — same-origin SW bootstrap (IIFE target).
```

### Design notes

- **Two SW strategies**. Same-origin mode needs the SW to be served next
  to the app (scope-rooted loader); relay mode puts the SW anywhere and
  ferries messages through an iframe, at the cost of a `CONNECT`
  round-trip per call. Pick the stricter mode when you own the origin.
- **Adapter key = URL segment**. For the same-origin path, the adapter's
  `key` option **must match** the first URL segment the SW routes to it:
  if `key: "demo"` and the SW scope is `/public/`, handlers answer at
  `/public/demo/…`. The SW extracts the segment from the URL and looks up
  `handlersIndex` by key. This is why
  `adapter.register(\`${KEY}/api/\`, …)` prefixes the registration path
  with the same key.
- **IIFE for SW bundles**. The SW runtime bundles (`relay-sw.js`,
  `sw-worker.js`) are IIFE rather than ESM so a classic
  `importScripts(...)` loader script can pull them in. Registering as
  `{ type: "module" }` SWs would work but is subject to
  `Service-Worker-Allowed` header games for a scope wider than the
  bundle's directory.
- **ESM page-side bundles are self-contained**. `dist/index.js` and
  `dist/sw.js` inline their dependencies (including `idb-keyval` and
  `@statewalker/webrun-http`) so a page can load them straight from a
  static host without a bundler or import map.
- **`recieveData` uses `newAsyncGenerator`**. The queue-based async
  generator gives explicit backpressure (each `next(value)` returns a
  `Promise<boolean>`) and drains in-flight producers on consumer exit.
- **SW client registry is IndexedDB-persisted**. Both `SwPortDispatcher`
  (same-origin) and `relay/index-sw.ts` keep their client-lookup tables in
  IndexedDB so a SW wake-up after idle doesn't lose its bindings.

### Constraints

- **ServiceWorker scope rules apply.** A SW registered at `/public/sw-worker.js`
  only controls pages and fetches under `/public/`. If you need a broader
  scope, the SW script must be served with the
  `Service-Worker-Allowed` HTTP header, *or* live higher in the origin.
- **`http://localhost` or HTTPS only.** Browsers refuse to register SWs
  on other `http://` origins.
- **Relay mode needs an iframe-capable sandbox.** Pages with strict CSP
  that blocks `frame-src` to the relay origin can't use the relay path.
- **Consumer-side `fetch()` only works from pages under the SW's scope.**
  When your caller is on another origin, use `callHttpService(request,
  …)` — it reaches the SW through the iframe's MessagePort and bypasses
  the browser's fetch routing.

### Dependencies

Runtime:

- `@statewalker/webrun-http` — HTTP envelope (de)serialisation, stubs,
  `HttpError`, stream helpers. Workspace-local.
- `idb-keyval` — tiny (<1 KB) IndexedDB KV used by both SW modes to keep
  client/service registrations across SW restarts.

Dev: TypeScript, vitest, rolldown, rimraf, `http-server` (for the
`example:*` scripts), `@types/node` (catalog versions from the monorepo
root).

## License

MIT © statewalker
