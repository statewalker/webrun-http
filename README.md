# webrun-http

**Run real HTTP servers in a browser tab — no backend, no network round-trip.**

`webrun-http` is a pnpm workspace that ships a pair of libraries for moving
HTTP `Request` / `Response` traffic over arbitrary byte channels. Together
they let you write ordinary request handlers and have them answer standard
`fetch()` calls from any page — with the "server" running in the same tab,
in a sibling tab, or inside a relay iframe.

## Why

The web platform already gives browsers everything they need to *be* an HTTP
server: `Request` / `Response` / `ReadableStream` / `ServiceWorker`. What's
missing is glue to carry those objects across whichever channel happens to
separate your handler from your caller. That's this project.

Typical use cases:

- **In-browser full-stack prototypes** — back-end code and client code live
  in the same page, no external services to start.
- **Notebook / Observable / unpkg demos** — ship a working app where the
  reader doesn't have to install anything.
- **Local-disk or OPFS servers** — expose File System Access API content as
  a plain HTTP site you can `<iframe>` or `fetch()`.
- **Offline-first apps** — your back-end is literally a JS function; it
  works without network.
- **Portable handlers** — the same async `(Request) ⇒ Response` function
  runs here today and in Deno / Cloudflare Workers / Node tomorrow.

## Packages

### [`@statewalker/webrun-http`](./packages/webrun-http)

Transport-agnostic `Request` / `Response` streaming over async iterators.
Two layers:

- **Stubs** — `newHttpClientStub` / `newHttpServerStub` (de)serialise HTTP
  envelopes against any `(envelope) ⇒ envelope` transport you provide.
- **Pipes** — `newHttpServer` / `newHttpClient` give you a server that is
  `AsyncIterable<Uint8Array> ⇒ AsyncIterable<Uint8Array>`, and a client
  that wires a `Request` through such a pipe.

Plus `HttpError`, and `toReadableStream` / `fromReadableStream` helpers for
moving bytes between iterators and streams.

Useful when you want to move HTTP semantics across a non-HTTP channel
(MessagePort, WebSocket, IPC, in-memory) without caring how the bytes
actually move.

### [`@statewalker/webrun-http-browser`](./packages/webrun-http-browser)

ServiceWorker-based HTTP server that runs entirely in the browser. Register
request handlers in JavaScript, call them with standard `fetch()` /
`Request` / `Response`.

Two operating modes:

- **Same-origin** — your app registers its own ServiceWorker next to its
  pages and mounts handlers under `<scope>/<key>/...`.
- **Relay** — a ServiceWorker running at a shared *relay* origin handles
  requests for any page that embeds a hidden relay iframe. Cross-origin
  friendly; works from notebooks, Observable, unpkg, etc.

See [`packages/webrun-http-browser/README.md`](./packages/webrun-http-browser/README.md)
for architecture, public API, and runnable demos (dynamic site with Hono
routing, in-browser file server backed by the File System Access API).

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

## Publishing

Via [Changesets](./PUBLISHING.md).

## License

MIT © statewalker
