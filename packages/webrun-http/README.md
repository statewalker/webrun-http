# @statewalker/webrun-http

Transport-agnostic HTTP `Request` / `Response` streaming over async iterators.
Runs anywhere standard `Request` / `Response` / `ReadableStream` work — Node,
Deno, browsers, ServiceWorkers.

## Why it exists

HTTP handlers are the most portable "unit of server" JavaScript has: a
function `(Request) ⇒ Promise<Response>` works identically in Deno, Node's
`fetch` handler, Cloudflare Workers, browser ServiceWorkers, and most edge
runtimes. What shifts across those environments is **how bytes move between
the handler and its caller** — sometimes HTTP, sometimes a MessagePort,
sometimes stdin/stdout, sometimes a WebSocket.

This package is the glue. It turns a `Request` into a byte envelope you can
push through any channel, and turns the returned bytes back into a
`Response` on the other end. Once you have two endpoints that can move
`Uint8Array`s, you get HTTP semantics for free.

It was extracted from `@statewalker/webrun-http-browser`, where the same
serialisation was baked into the ServiceWorker / relay plumbing. Sharing a
single HTTP-serialisation layer avoids drift between the browser package
and future back-ends (Node, Deno).

## How to use

```sh
npm install @statewalker/webrun-http
```

The public surface is four functions plus a helper error type:

| Export | Purpose |
| --- | --- |
| `newHttpServerStub(handler)` | Turn a `(Request) ⇒ Response` handler into a `(envelope) ⇒ envelope` function you can hook to any transport |
| `newHttpClientStub(send)` | Given a transport `(envelope) ⇒ envelope`, produce a `(Request) ⇒ Response` caller |
| `newHttpServer(handler)` | Wrap the server stub into a byte-stream pipe: `AsyncIterable<Uint8Array> ⇒ AsyncIterable<Uint8Array>` |
| `newHttpClient(pipe)` | Wrap the client stub against such a pipe: `(Request) ⇒ Promise<Response>` |
| `HttpError` | `Error` subclass with `status` / `statusText` and factory helpers (`errorResourceNotFound`, `errorForbidden`, `errorResourceGone`, `errorInternalError`, `fromError`) |
| `toReadableStream` / `fromReadableStream` | Convert between `AsyncIterator<Uint8Array>` and `ReadableStream<Uint8Array>` |

Stubs sit one level below pipes: use them when your transport already has
a request/response shape (e.g. `postMessage` with a reply channel). Use
pipes when your transport is just a pair of byte streams.

## Examples

### In-process server via the pipe API

```ts
import { newHttpClient, newHttpServer } from "@statewalker/webrun-http";

const handler = async (request: Request) => {
  return new Response(JSON.stringify({ ok: true, url: request.url }), {
    headers: { "Content-Type": "application/json" },
  });
};

const server = newHttpServer(handler);   // AsyncIterable<Uint8Array> ⇒ AsyncIterable<Uint8Array>
const client = newHttpClient(server);    // Request ⇒ Promise<Response>

const res = await client(new Request("http://example.com/api"));
console.log(await res.json()); // { ok: true, url: "http://example.com/api" }
```

### Custom transport via stubs

When the channel between caller and handler isn't a byte stream — e.g. a
`MessagePort`, a WebSocket message frame, a JSON-RPC packet — drop to the
stub layer and plug in your own round-trip function:

```ts
import {
  newHttpClientStub,
  newHttpServerStub,
  type SerializedHttpEnvelope,
  type SerializedHttpRequest,
  type SerializedHttpResponse,
} from "@statewalker/webrun-http";

const stub = newHttpServerStub(async (req) => new Response("hello"));

async function sendOverMyChannel(
  req: SerializedHttpEnvelope<SerializedHttpRequest>,
): Promise<SerializedHttpEnvelope<SerializedHttpResponse>> {
  // ...move req over the wire, receive the response envelope, return it.
  return stub(req);
}

const fetchOverMyChannel = newHttpClientStub(sendOverMyChannel);
const response = await fetchOverMyChannel(new Request("https://anything/api"));
```

### Streaming a POST body

Request/response bodies are preserved as `ReadableStream`s end-to-end — no
buffering, no `await request.text()` required:

```ts
import {
  newHttpClient,
  newHttpServer,
  toReadableStream,
} from "@statewalker/webrun-http";

const handler = async (req: Request) =>
  new Response(`echo:${await req.text()}`, {
    headers: { "Content-Type": "text/plain" },
  });

const client = newHttpClient(newHttpServer(handler));

const encoder = new TextEncoder();
async function* body() {
  yield encoder.encode("hello ");
  yield encoder.encode("world");
}

const response = await client(
  new Request("http://localhost/echo", {
    method: "POST",
    body: toReadableStream(body()) as BodyInit,
    duplex: "half",
  } as RequestInit & { duplex: "half" }),
);
console.log(await response.text()); // "echo:hello world"
```

## Internals

### Envelope format

The wire format is a two-part envelope: one JSON-encoded `options` object
(method, url, headers, status, statusText, …) followed by a stream of
binary body chunks.

```
[ Uint8Array: JSON(options) ] [ Uint8Array body chunk ] [ Uint8Array body chunk ] … EOF
```

The stubs handle the framing. At the pipe level (`newHttpServer` /
`newHttpClient`) the first `yield` is always the options, the rest is the
body. This means the caller learns status / headers **before** the full
body arrives — the `Response` object can be constructed and returned to
the consumer while its body is still streaming.

### `SerializedHttpEnvelope<Options>`

Envelopes are plain data, so they can travel through JSON-only transports
or structured-clone boundaries:

```ts
interface SerializedHttpEnvelope<Options> {
  options: Options;                         // headers, method, status, …
  content: AsyncIterable<Uint8Array>;       // body chunks
}
```

`Options` is `SerializedHttpRequest` on the way in and
`SerializedHttpResponse` on the way out. Both include a `headers` array of
`[name, value]` pairs (array, not `Headers`, so it's cloneable).

### Design notes

- **Bodyless methods**. `GET`, `HEAD`, and `OPTIONS` responses skip the
  body stream entirely — reading a zero-body stream is replaced by
  `iterable.return()`, so transports aren't forced to emit a terminator
  for no-body calls.
- **Array-of-tuples for headers**. `Headers` isn't structured-cloneable in
  all runtimes (some older edge sandboxes), so envelopes always ship
  headers as `Array<[string, string]>` and reconstruct a `Headers`
  instance at the other end.
- **No retry / timeout / auth logic**. Those are transport concerns — the
  point of this package is that they stay out of the HTTP-semantics layer.

### Constraints

- **Duplex bodies need `duplex: "half"`**. Construction of a streaming
  request body uses the standard Fetch-API pattern; consumers on platforms
  that don't support `duplex` (older Node versions) must upgrade.
- **Headers are case-folded by `Headers`**. Round-tripping a request with
  `X-Foo` ends up as `x-foo` on the server — same behaviour as the native
  `fetch`.

### Dependencies

**Zero runtime dependencies.** Only peer on the platform's `Request` /
`Response` / `ReadableStream` / `TextEncoder` / `TextDecoder` / `fetch`
builtins.

Dev dependencies: TypeScript, vitest, rolldown, rimraf, `@types/node`
(catalog versions from the monorepo root).

## Scripts

```sh
pnpm test        # vitest run
pnpm run build   # rolldown + tsc --emitDeclarationOnly
pnpm lint        # biome check
```

## License

MIT © statewalker
