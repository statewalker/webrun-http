# @statewalker/webrun-http-browser

ServiceWorker-based HTTP server for browsers. Register request handlers in
JavaScript, call them with `fetch()` and standard `Request` / `Response`
objects — no network round-trip, no external server.

Runs in two modes:

- **Same-origin (`./sw`)** — your app registers its own ServiceWorker and
  mounts handlers next to the page. Minimal setup, strict same-origin
  constraint.
- **Relay (default entry)** — a ServiceWorker running at a shared *relay*
  origin (e.g. a CDN) serves requests on behalf of any page that embeds a
  hidden relay iframe. Cross-origin friendly — works from Observable,
  notebooks, third-party hosts, etc.

## Installation

```sh
npm install @statewalker/webrun-http-browser
```

## Architecture

```
src/
├── core/                    ┐
│   ├── data-calls.ts        │  Primitives: one-shot and streaming
│   ├── data-channels.ts     │  message-channel calls, backpressure,
│   ├── data-send-recieve.ts │  error (de)serialisation.
│   ├── errors.ts            │
│   ├── iterate.ts           │
│   ├── message-target.ts    │
│   └── registry.ts          ┘
├── http/                    ┐
│   ├── http-error.ts        │  HTTP layer: Request/Response
│   ├── http-send-recieve.ts │  (de)serialisation over streaming
│   ├── http-stubs.ts        │  channels, ReadableStream helpers.
│   └── readable-streams.ts  ┘
├── sw/                      ┐
│   ├── sw-dispatcher.ts     │  Same-origin path:
│   └── http-sw-dispatcher.ts│  SwHttpAdapter (page) / SwHttpDispatcher (SW).
│                            ┘
├── relay/                   ┐
│   ├── index.ts             │  Relay path:
│   ├── index-sw.ts          │  newRemoteRelayChannel, initHttpService,
│   └── split-service-url.ts │  callHttpService, relay SW.
│                            ┘
├── index.ts                 — main entry: core + http + relay
├── sw.ts                    — `./sw` subpath entry (same-origin path)
├── relay-sw.ts              — bootstraps the relay SW (served as a SW script)
└── sw-worker.ts             — bootstraps the same-origin SW (ditto)
```

## Relay mode (cross-origin)

Your page ↔ relay iframe ↔ relay ServiceWorker. The relay SW claims URLs
shaped `<relay-origin>/~<service-key>/...` and forwards each request to the
page that registered that `key`.

```ts
import {
  newRemoteRelayChannel,
  initHttpService,
  callHttpService,
} from "@statewalker/webrun-http-browser";

// 1. Embed a relay iframe and open a MessagePort into its ServiceWorker.
const connection = await newRemoteRelayChannel({
  url: new URL("https://my-relay.example/public-relay/relay.html"),
});

// 2. Register a handler for service "FS".
const baseUrl = `${connection.baseUrl}~FS`;
await initHttpService(
  async (request) => new Response(`Hello ${new URL(request.url).pathname}`),
  { key: "FS", port: connection.port },
);

// 3a. Any browser tab loading the service URL is now served by your handler:
await fetch(`${baseUrl}/anything`);

// 3b. ...or call it directly through the same port (bypassing `fetch`):
const res = await callHttpService(
  new Request(`${baseUrl}/anything`),
  { key: "FS", port: connection.port },
);
```

See [`demo/demo-1.html`](./demo/demo-1.html) and
[`demo/demo-2.html`](./demo/demo-2.html) for full examples (an in-browser
dynamic site with Hono routing, and a local-filesystem browser).

## Same-origin mode

Your page registers its own ServiceWorker and attaches handlers locally.

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

// fetch("/path-to-page/demo/api/anything") is intercepted by the SW.
```

The SW script itself is provided by the package — a tiny loader in your
app's directory re-exports it so the SW scope covers your app:

```js
// public/sw-worker.js — served next to your app pages.
importScripts("/path/to/node_modules/@statewalker/webrun-http-browser/dist/sw-worker.js");
```

See [`public/`](./public) for a complete example.

## Scripts

```sh
pnpm test              # vitest run
pnpm run build         # rolldown + tsc --emitDeclarationOnly
pnpm lint              # biome check
```

## License

MIT © statewalker
