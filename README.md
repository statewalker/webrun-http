# webrun-wire

**Move `Request`, `Response`, and async iterators over any byte channel —
MessagePort, WebSocket, ServiceWorker, in-process pipe, real HTTP —
with the same handler code on both ends.**

`webrun-wire` is a pnpm workspace that builds up, layer by layer, the
ability to write ordinary `(Request) ⇒ Response` handlers and RPC
service objects and run them anywhere bytes can flow. The "server" can
live in the same tab, in a sibling tab, inside a relay iframe, behind a
MessagePort, over a WebSocket, or on a real HTTP endpoint — callers use
standard `fetch()` and don't know the difference.

## Why it exists

The web platform gives browsers everything they need to *be* an HTTP
server: `Request`, `Response`, `ReadableStream`, `ServiceWorker`. What's
missing from the raw APIs is:

1. **A portable wire format** so you can move HTTP semantics over any
   byte channel (MessagePort, WebSocket, IPC, in-memory).
2. **ServiceWorker plumbing** — URL routing, MessageChannel wiring,
   recovery after SW restarts — and a way to use a SW from a page that
   isn't on the SW's origin.
3. **Stream primitives** (backpressure-aware iterators, WHATWG
   ReadableStream ↔ async iterator) shared across all the above without
   duplication.
4. **A service-RPC layer** that takes a plain object and exposes its
   methods as HTTP endpoints — same code running over real HTTP, an
   in-browser SW, a MessagePort, or a WebSocket.

This workspace solves all four as small, composable packages, each
publishable on its own and each carrying zero runtime dependencies
beyond other `@statewalker/webrun-*` packages in the same workspace.

## Typical use cases

- **In-browser full-stack prototypes** — back-end and client live in the
  same page, no external services to start.
- **Notebook / Observable / unpkg demos** — ship a working app where the
  reader doesn't have to install anything.
- **Local-disk or OPFS servers** — expose File System Access API content
  as a plain HTTP site you can `<iframe>` or `fetch()`.
- **Offline-first apps** — your back-end is literally a JS function; it
  works without network.
- **WebSocket-backed services** — write ordinary HTTP handlers, run them
  over a persistent socket.
- **Portable handlers** — the same async `(Request) ⇒ Response` function
  runs here today and in Deno / Cloudflare Workers / Node tomorrow.

## Dependency graph

```
webrun-streams        (foundation — iterator + stream + error primitives)
    ▲
    ├── webrun-ports              (MessagePort RPC)
    │       ▲
    │       └── webrun-ports-ws   (WebSocket ↔ MessagePort bridge)
    │
    ├── webrun-http               (Request/Response over any byte channel)
    │       ▲
    │       ├── webrun-http-browser   (ServiceWorker hosting, relay mode)
    │       └── webrun-rpc-http       (service-RPC on top of webrun-http)
    │
    ├── webrun-site-builder       (files + endpoints + auth → (Request)⇒Response)
    │       (peer: @statewalker/webrun-files for the FilesApi interface)
    │
    └── (all of the above use webrun-streams for chunks + errors)
```

Every arrow is a `workspace:*` dep. Nothing deeper than
`webrun-streams` has runtime dependencies outside this repo except
`webrun-http-browser`, which pulls in `idb-keyval` (≈1 KB) to survive
SW restarts.

## Packages

### [`@statewalker/webrun-streams`](./packages/webrun-streams)

Tiny async-iterator and `ReadableStream` primitives:

- `newAsyncGenerator` — backpressure-aware queue generator that turns
  imperative `next`/`done` callbacks into an async generator.
- `sendIterator` / `recieveIterator` — a `{done, value, error}` chunk
  protocol for shipping an async iterator across any transport.
- `toReadableStream` / `fromReadableStream` — one-way converters between
  `AsyncIterator<Uint8Array>` and `ReadableStream<Uint8Array>`.
- `serializeError` / `deserializeError` — preserve `Error` stack and
  custom fields across JSON / structured-clone boundaries.

Zero runtime deps. Every other package in the workspace depends on it.

### [`@statewalker/webrun-ports`](./packages/webrun-ports)

MessagePort utilities — request/response, streaming, bidirectional calls
— multiplexed over a single `MessagePort` via a `channelName` tag.

- `callPort` / `listenPort` — request/response with timeout.
- `send` / `recieve` — async-iterator streams.
- `ioSend` / `ioHandle` — bidirectional half-duplex primitives.
- `callBidi` / `listenBidi` — high-level full-duplex streaming calls.

Zero runtime dependencies. The narrow-waist transport any higher-level
MessagePort protocol can build on.

### [`@statewalker/webrun-ports-ws`](./packages/webrun-ports-ws)

**WebSocket ↔ MessagePort bridge.** Wire a `WebSocket` to a
`MessagePort` with `bindWebSocketToPort(ws, port)` and every helper in
`webrun-ports` (request/response, streaming, bidi) runs unchanged.
Transport-neutral: JSON text frames, binary as transferable
`ArrayBuffer`, idempotent cleanup, works with browser `WebSocket` or
Node's [`ws`](https://www.npmjs.com/package/ws) package. No RPC layer,
no new wire format.

Zero runtime dependencies.

### [`@statewalker/webrun-http`](./packages/webrun-http)

Transport-agnostic `Request` / `Response` streaming over async
iterators. Two layers:

- **Stubs** — `newHttpClientStub` / `newHttpServerStub` (de)serialise
  HTTP envelopes against any `(envelope) ⇒ envelope` transport you
  provide.
- **Pipes** — `newHttpServer` / `newHttpClient` give you a server that
  is `AsyncIterable<Uint8Array> ⇒ AsyncIterable<Uint8Array>`, and a
  client that wires a `Request` through such a pipe.

Plus `HttpError`, and `toReadableStream` / `fromReadableStream` helpers
re-exported from `webrun-streams`.

Zero runtime dependencies. Peers on standard `Request` / `Response` /
`ReadableStream` / `TextEncoder` / `TextDecoder`.

### [`@statewalker/webrun-http-browser`](./packages/webrun-http-browser)

ServiceWorker-based HTTP server that runs entirely in the browser.
Register handlers in JavaScript, call them with standard `fetch()` /
`Request` / `Response`.

Two operating modes:

- **Same-origin** (`.../sw` subpath) — your app registers its own SW
  next to its pages and mounts handlers under `<scope>/<key>/…`.
- **Relay** (main entry) — a SW running at a shared relay origin handles
  requests for any page that embeds a hidden relay iframe. Cross-origin
  friendly; works from notebooks, Observable, unpkg, third-party hosts.

See
[`packages/webrun-http-browser/README.md`](./packages/webrun-http-browser/README.md)
for architecture, public API, design notes, constraints, and runnable
demos (Hono-routed dynamic site and a File System Access API browser).

### [`@statewalker/webrun-rpc-http`](./packages/webrun-rpc-http)

**HTTP-based service RPC.** Expose plain object methods as a standard
`(Request) ⇒ Response` handler; call them from anywhere with `fetch`:

- `newRpcServer(services, {path?})` → a webrun-http handler that
  routes `GET /`, `GET /{service}`, `GET|POST /{service}/{method}` into
  method calls.
- `newRpcClient({baseUrl, fetch?})` → `{ loadService<T>(name) }` with
  lazy descriptor caching; typed method proxies round-trip through
  `fetch`.

Because the server is a webrun-http handler and the client takes an
injectable `fetch`, the same RPC code runs unchanged over real HTTP, an
in-browser ServiceWorker, a MessagePort bridge, or a WebSocket — wire it
to whichever transport fits the deployment.

Depends on `@statewalker/webrun-streams` for error serialization.

### [`@statewalker/webrun-site-builder`](./packages/webrun-site-builder)

**Compose a `(Request) ⇒ Response` site** from three ingredients:
static files mounted from any `FilesApi` (memory / Node FS / S3 /
browser FSAA / composite), dynamic endpoints with URLPattern-based
routing, and pluggable auth hooks (ships with an HTTP basic-auth
factory):

```ts
new SiteBuilder()
  .setFiles("/", files)
  .setAuth("/admin/*", newBasicAuth({ tom: "!jerry!" }))
  .setEndpoint("/api/todo/:id", "GET", handler)
  .build(); // ⇒ (Request) ⇒ Response
```

The builder is deliberately framework-free: URLPattern for routing,
a small MIME map, `Range`/`HEAD` support driven by
`FilesApi.stats()` + `read({start, length})`. Zero runtime deps
beyond a peer `@statewalker/webrun-files`.

## Putting it together

The packages are designed to compose into end-to-end stacks. A few
concrete combinations:

| Use case | Stack |
| --- | --- |
| In-browser service RPC with offline-capable `fetch()` | `webrun-rpc-http` + `webrun-http-browser` (same-origin mode) + `webrun-http` |
| Cross-origin RPC from an embed (Observable, unpkg) | `webrun-rpc-http` + `webrun-http-browser` (relay mode) + `webrun-http` |
| Static site + dynamic API + auth, served from anywhere | `webrun-site-builder` + any `FilesApi` + a transport of your choice |
| Node ↔ browser RPC over a WebSocket | `webrun-ports` + `webrun-ports-ws` on each end; optionally pipe `webrun-http` through for `Request`/`Response` semantics |
| Unit tests for an RPC service | `webrun-rpc-http` with `fetch: (req) => handler(req)` — no network at all |
| Deploying the same handler to a real edge runtime | `webrun-rpc-http` handler drops straight into Deno / Cloudflare Workers / Bun |

## Workspace

```sh
pnpm install
pnpm test              # turbo runs `test` in every package
pnpm run build         # turbo runs `build` in every package
pnpm lint              # biome check .
pnpm format:fix        # biome check --write --unsafe .
```

Tooling: **pnpm workspace**, **turborepo**, **biome**, **vitest**,
**rolldown**, **TypeScript**. No eslint / prettier / rollup / mocha.

### Self-contained bundles

Every package emits a single ESM bundle at `dist/index.js` with **zero
bare import specifiers** surviving into the output (workspace deps are
inlined). Packages load cleanly from a static host without an import
map or extra bundler on the consumer side.

The browser package additionally ships IIFE bundles for its SW
runtimes — loadable via classic `importScripts(...)`.

## Publishing

Via [Changesets](./PUBLISHING.md).

## License

MIT © statewalker
