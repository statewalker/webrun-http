# webrun-http

HTTP utilities for the webrun ecosystem — pnpm workspace monorepo.

## Packages

### [`@statewalker/webrun-http`](./packages/webrun-http)

Transport-agnostic `Request` / `Response` streaming over async iterators.
Two layers: **stubs** that (de)serialise HTTP envelopes against any
`(envelope) ⇒ envelope` transport, and **pipes** that express a server as
`AsyncIterable<Uint8Array> ⇒ AsyncIterable<Uint8Array>`.

Useful when you want to move HTTP semantics across a non-HTTP channel
(MessagePort, WebSocket, IPC, in-memory) without caring how the bytes
actually move.

### [`@statewalker/webrun-http-browser`](./packages/webrun-http-browser)

ServiceWorker-based HTTP server that runs entirely in the browser. Register
request handlers in JavaScript, call them with standard `fetch()` /
`Request` / `Response` — no network round-trip, no external server.

Two operating modes:

- **Same-origin** — your app registers its own ServiceWorker next to its
  pages and mounts handlers under `<scope>/<key>/...`.
- **Relay** — a ServiceWorker running at a shared *relay* origin handles
  requests for any page that embeds a hidden relay iframe. Cross-origin
  friendly; works from notebooks, Observable, unpkg, etc.

Useful for:

- In-browser dynamic sites (routers, static files, JSON APIs) with no
  backend.
- Serving local-disk or OPFS content to an iframe via the File System
  Access API.
- Self-contained demos and prototypes that work offline.
- Full-stack prototypes that can later be lifted to Deno / Cloudflare /
  Node without rewriting the handler code.

See [`packages/webrun-http-browser/README.md`](./packages/webrun-http-browser/README.md)
for the architecture, public API, and runnable demos.

## Workspace

```sh
pnpm install
pnpm test              # turbo runs `test` in every package
pnpm run build         # turbo runs `build` in every package
pnpm lint              # biome check .
pnpm format:fix        # biome check --write --unsafe .
```

## Publishing

Via [Changesets](./PUBLISHING.md).
