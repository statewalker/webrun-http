# @statewalker/webrun-ports

MessagePort utilities: request/response with timeout, async-iterator
streams, and full-duplex bidirectional calls — all over a single
`MessagePort`.

## Why it exists

`MessagePort` gives you `postMessage` + `onmessage` and nothing else. In
practice you almost always want more:

- **A request/response pattern** so callers get answers (or timeouts)
  for each call they make.
- **Async-iterator transport** so streams of values flow from one side
  to the other with proper `{done, value, error}` semantics.
- **Multiplexing** over a single port — several concurrent logical
  "channels" sharing one `MessageChannel`, distinguished by a
  `channelName` tag.
- **Bidirectional calls**: the caller both sends *and* receives a stream
  in a single logical invocation.

This package bundles those four patterns as small composable functions.
Nothing else depends on them — no HTTP, no ServiceWorker, no Workers — so
it's the narrow waist any higher-level MessagePort protocol can build on.

## How to use

```sh
npm install @statewalker/webrun-ports
```

Every function takes a standard DOM `MessagePort` (both ends of a
`new MessageChannel()`, the port a `Worker` exposes, anything that
implements `postMessage` + `addEventListener("message", …)`). Remember
to call `.start()` on manually-constructed ports before use.

| Export | Layer | Purpose |
| --- | --- | --- |
| `callPort(port, params, opts?)` | request/response | Sends `params`, waits for a matching reply, rejects on timeout |
| `listenPort(port, handler, opts?)` | request/response | Registers `handler` as the server; returns a cleanup fn |
| `sendIterator(send, iterable)` | stream, transport-agnostic | Drains an iterable into `{done, value, error}` chunks |
| `recieveIterator(installer)` | stream, transport-agnostic | Rebuilds an async iterator from incoming chunk callbacks |
| `send(port, output, opts?)` | stream over port | `sendIterator` bound to `callPort` |
| `recieve(port, opts?)` | stream over port | Async generator of async generators — one per inbound stream |
| `ioSend(port, output, opts?)` | bidirectional | Send `output` while yielding what the peer sends back |
| `ioHandle(port, handler, opts?)` | bidirectional | Server half of `ioSend` |
| `callBidi(port, input, args?)` | high-level bidi | Allocates a sub-channel and wires `ioSend` through it |
| `listenBidi(port, action, accept?)` | high-level bidi | Server half of `callBidi` |
| `serializeError` / `deserializeError` | errors | Ship `Error` objects over `postMessage` and reconstruct them |
| `newAsyncGenerator` | internal, re-exported | Backpressure-aware async generator used by `recieveIterator` |

## Examples

### Request / response

```ts
import { callPort, listenPort } from "@statewalker/webrun-ports";

const channel = new MessageChannel();
channel.port1.start();
channel.port2.start();

const close = listenPort(channel.port1, async (params) => ({
  message: "Hello World!",
  params,
}));

try {
  const result = await callPort(channel.port2, { foo: "bar" });
  //         { message: "Hello World!", params: { foo: "bar" } }
} finally {
  close();
}
```

Timeouts default to **1000 ms**. Server errors are serialised and rethrown
on the caller's side as `Error` instances — stack and custom fields
preserved.

### Multiplexing with `channelName`

```ts
const closeA = listenPort(port1, async () => "A", { channelName: "a" });
const closeB = listenPort(port1, async () => "B", { channelName: "b" });

await callPort(port2, {}, { channelName: "a" }); // → "A"
await callPort(port2, {}, { channelName: "b" }); // → "B"
```

Both listeners share the same physical port; messages are routed by the
`channelName` tag attached to every envelope.

### Streaming values

```ts
import { recieve, send } from "@statewalker/webrun-ports";

// Producer side.
void send(channel.port2, ["hello", "world"]);

// Consumer side: the outer loop yields once per inbound stream.
for await (const input of recieve<string>(channel.port1)) {
  for await (const value of input) console.log(value); // "hello", "world"
  break;
}
```

### Full-duplex (callBidi / listenBidi)

```ts
import { callBidi, listenBidi } from "@statewalker/webrun-ports";

const close = listenBidi<string, string>(
  channel.port1,
  async function* handler(input, params) {
    for await (const value of input) yield value.toUpperCase();
  },
);

try {
  for await (const v of callBidi<string, string>(
    channel.port2,
    ["Hello", "World"],
    { foo: "Bar" },
  )) {
    console.log(v); // "HELLO", then "WORLD"
  }
} finally {
  close();
}
```

`callBidi` generates a fresh `channelName` per invocation, so many
concurrent bidi streams can share one `MessagePort` without interfering.

## Internals

### Wire format

Every message is a plain object with a discriminated `type`. Envelopes
carry a `channelName` (string, `""` by default) and a `callId`:

```
request :  { type: "request",          channelName, callId, params }
result  :  { type: "response:result",  channelName, callId, result }
error   :  { type: "response:error",   channelName, callId, error }    // serialised
```

Listeners filter on `channelName`; callers additionally match `callId`
against a map of pending promises. Unknown messages are ignored silently
so multiple protocols can coexist on one port.

### Timeouts

`callPort` arms a `setTimeout` per call. When it fires, the pending
promise rejects with `Error("Call timeout. CallId: …")` and the
listener is detached. This is the only back-pressure signal at the
request/response layer — anything slower than the timeout is simply
aborted.

### Streaming layer

`sendIterator` converts a `for-await` iterator into a chain of per-chunk
"send" calls. On the receive side `recieveIterator` installs a callback
that forwards each `{done, value, error}` chunk into `newAsyncGenerator`,
which provides backpressure (every `next(value)` returns
`Promise<boolean>` indicating whether the consumer is still listening).

The streaming helpers don't re-use the `callPort` timeout for individual
chunk round-trips by default — you pass a small `timeout` for per-chunk
acknowledgement and a much larger `bidiTimeout` for the outer stream.

### Bidi sub-channels

`callBidi` generates a random numeric `channelName`, fires a normal
`callPort` with that name as part of `params`, and then runs `ioSend`
on the same `channelName`. The server-side `listenBidi` inspects the
announced `channelName`, optionally calls an `accept` predicate, and
invokes `ioHandle` on that name.

The outer `callPort` promise acts as the completion signal: when the
server's handler finishes, it returns (via the wrapping
`listenPort`) and the caller's outer call resolves.

### Design notes

- **Copy, don't depend.** `newAsyncGenerator` is inlined rather than
  imported from a shared utils package. Keeps the dependency graph at
  zero runtime deps.
- **British/American spelling kept.** Function names use `recieve` (the
  misspelling from the original API) to avoid breaking consumers that
  already import `recieve` / `recieveIterator`.
- **`start()` on manual `MessagePort`s.** DOM `MessagePort`s start in a
  paused state unless created via `onmessage` binding. Tests and helpers
  call `.start()` explicitly.

### Constraints

- **Node.js ≥ 20** for `MessageChannel` / `MessagePort` with `addEventListener`
  (Node's `worker_threads` `MessagePort` implements `EventTarget`).
- **Browser `MessagePort` / `Worker` / `ServiceWorker`** — everything else
  implementing `postMessage` and `addEventListener("message")` works.
- **One `listenPort` per `(port, channelName)`**. Multiple listeners on
  the same channel name compete for the same messages; call cleanup
  returned from each `listenPort` to detach.

### Dependencies

**Zero runtime dependencies.** Depends only on platform builtins
(`MessageChannel`, `Error`, `Promise`, `setTimeout`).

Dev dependencies: TypeScript, vitest, rolldown, rimraf, `@types/node`
(catalog versions from the monorepo root).

## Scripts

```sh
pnpm test        # vitest run
pnpm run build   # rolldown + tsc --emitDeclarationOnly
pnpm lint        # biome check src tests
```

## License

MIT © statewalker
