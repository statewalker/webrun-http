# @statewalker/webrun-http

Transport-agnostic HTTP `Request` / `Response` streaming over async iterators.

The package ships two layers:

- **Stubs** (`newHttpClientStub` / `newHttpServerStub`) — serialise a
  `Request` into a `{ options, content }` envelope (headers + body
  iterator) and deserialise back on the other side. The transport function
  is a plain `(envelope) ⇒ envelope`, so it fits any channel — HTTP,
  WebSocket, MessagePort, process pipe, in-memory.
- **Pipes** (`newHttpServer` / `newHttpClient`) — one step higher. A
  server is an `AsyncIterable<Uint8Array> ⇒ AsyncIterable<Uint8Array>` pipe
  that accepts serialised-request bytes and emits serialised-response
  bytes. A client takes a pipe and gives you an `(request) ⇒ Response`
  function.

Plus small helpers:

- `toReadableStream(it)` / `fromReadableStream(stream)` — convert between
  async iterators of `Uint8Array` and `ReadableStream<Uint8Array>`.
- `HttpError` — an `Error` subclass with `status` / `statusText` and
  factory helpers for common 4xx/5xx responses.

## Install

```sh
npm install @statewalker/webrun-http
```

## Quick start

```ts
import { newHttpClient, newHttpServer } from "@statewalker/webrun-http";

const httpHandler = async (request: Request) => {
  return new Response(JSON.stringify({ ok: true, url: request.url }), {
    headers: { "Content-Type": "application/json" },
  });
};

// Server pipe: bytes in → bytes out.
const server = newHttpServer(httpHandler);
// Client handler: Request → Promise<Response>, wired to the server pipe.
const client = newHttpClient(server);

const res = await client(new Request("http://example.com/api"));
console.log(await res.json()); // { ok: true, url: "http://example.com/api" }
```

For cross-process / cross-origin transports use the stubs directly so you
can plug your own serialiser:

```ts
import { newHttpClientStub, newHttpServerStub } from "@statewalker/webrun-http";

const sendOverYourChannel = async (requestEnvelope) => {
  // Serialise, send, receive, deserialise — your choice.
  return responseEnvelope;
};
const fetchOverYourChannel = newHttpClientStub(sendOverYourChannel);
```

## Scripts

```sh
pnpm test        # vitest run
pnpm run build   # rolldown + tsc --emitDeclarationOnly
pnpm lint        # biome check
```

## License

MIT © statewalker
