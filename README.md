# webrun-http

**Run real HTTP servers in a browser tab — no backend, no network
round-trip.**

`webrun-http` is a pnpm workspace with two libraries that together let you
write ordinary `(Request) ⇒ Response` handlers and have them answer
standard `fetch()` calls. The "server" runs in the same tab, in a sibling
tab, or inside a relay iframe — never over the network.

## Why it exists

The web platform already gives browsers everything they need to *be* an
HTTP server: `Request`, `Response`, `ReadableStream`, `ServiceWorker`.
Two pieces are missing from the raw APIs:

1. **A portable serialisation** so you can move HTTP semantics over any
   byte channel (MessagePort, WebSocket, IPC, in-memory).
2. **ServiceWorker plumbing** — URL routing, MessageChannel wiring,
   recovery after SW restarts — and a way to use a SW from a page that
   isn't on the SW's origin.

`@statewalker/webrun-http` solves (1); `@statewalker/webrun-http-browser`
builds on it to solve (2). The split means the same envelope format that
drives the browser's ServiceWorker can drive a future Node / Deno /
Cloudflare Worker runtime without rewriting the transport.

Typical use cases:

- **In-browser full-stack prototypes** — back-end and client live in the
  same page, no external services to start.
- **Notebook / Observable / unpkg demos** — ship a working app where the
  reader doesn't have to install anything.
- **Local-disk or OPFS servers** — expose File System Access API content
  as a plain HTTP site you can `<iframe>` or `fetch()`.
- **Offline-first apps** — your back-end is literally a JS function; it
  works without network.
- **Portable handlers** — the same async `(Request) ⇒ Response` function
  runs here today and in Deno / Cloudflare Workers / Node tomorrow.

## Packages

### [`@statewalker/webrun-ports`](./packages/webrun-ports)

MessagePort utilities: request/response with timeout (`callPort` /
`listenPort`), async-iterator streams (`send` / `recieve`), and
full-duplex calls (`callBidi` / `listenBidi`) — all multiplexed over a
single `MessagePort` via a `channelName` tag. Zero runtime dependencies.

The narrow-waist transport anything in this repo builds on when two
endpoints can move `postMessage` envelopes but nothing else.

### [`@statewalker/webrun-http`](./packages/webrun-http)

Transport-agnostic `Request` / `Response` streaming over async iterators.
Two layers:

- **Stubs** — `newHttpClientStub` / `newHttpServerStub` (de)serialise HTTP
  envelopes against any `(envelope) ⇒ envelope` transport you provide.
- **Pipes** — `newHttpServer` / `newHttpClient` give you a server that is
  `AsyncIterable<Uint8Array> ⇒ AsyncIterable<Uint8Array>`, and a client
  that wires a `Request` through such a pipe.

Plus `HttpError`, and `toReadableStream` / `fromReadableStream` helpers.
Zero runtime dependencies — only peer on standard `Request` / `Response`
/ `ReadableStream` / `TextEncoder` / `TextDecoder`.

### [`@statewalker/webrun-http-browser`](./packages/webrun-http-browser)

ServiceWorker-based HTTP server that runs entirely in the browser.
Register handlers in JavaScript, call them with standard `fetch()` /
`Request` / `Response`.

Two operating modes:

- **Same-origin** (`.../sw` subpath) — your app registers its own SW next
  to its pages and mounts handlers under `<scope>/<key>/…`.
- **Relay** (main entry) — a SW running at a shared relay origin handles
  requests for any page that embeds a hidden relay iframe. Cross-origin
  friendly; works from notebooks, Observable, unpkg, third-party hosts.

See [`packages/webrun-http-browser/README.md`](./packages/webrun-http-browser/README.md)
for architecture, public API, design notes, constraints, and runnable
demos (Hono-routed dynamic site and a File System Access API browser).

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

The browser package's `dist/` bundles are fully self-contained — no bare
import specifiers survive into the build output — so they can be loaded
straight from a static host with no import map or extra bundler on the
consumer side.

## Publishing

Via [Changesets](./PUBLISHING.md).

## License

MIT © statewalker
