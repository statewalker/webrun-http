# @statewalker/webrun-ports-ws

A transport-neutral **WebSocket ↔ MessagePort** bridge. Drop in a real
WebSocket and every helper in
[`@statewalker/webrun-ports`](../webrun-ports) (request/response,
streaming, full-duplex) runs unchanged. No new protocol, no new envelope
format, no RPC layer invented here.

## Why it exists

`webrun-ports` assumes a `MessagePort`: a bidirectional `postMessage` +
`message`-event pipe. Browsers give you that via `MessageChannel`;
`Worker`s and `ServiceWorker`s expose ports too. But a lot of real
deployments need the same request/response + streaming semantics over a
**WebSocket**:

- Node back-end ↔ browser tab.
- Browser tab ↔ browser tab via a ws relay server.
- Long-running services, IDE plugins, background workers with no shared
  memory.

Teaching `callPort` / `listenPort` / `callBidi` / `listenBidi` about
WebSockets would couple them to a transport. So the split is the other
way round: `webrun-ports` stays port-only; this package is a ~150-line
adapter that makes a WebSocket *look like* a port, after which everything
else in the webrun stack composes without modification.

The adapter is schema-less: it doesn't know what a `channelName` is, or
what a `callId` does, or what an envelope shape looks like. It only
knows how to move bytes + JSON between two endpoints. The `webrun-ports`
envelope happens to be exactly what the bridge needs — one plain JSON
object per message — so the pairing is lossless.

## How to use

```sh
npm install @statewalker/webrun-ports-ws @statewalker/webrun-ports
```

### Exports

| Export | Purpose |
| --- | --- |
| `bindWebSocketToPort(ws, port)` | Wire a `WebSocket` to a `MessagePort`. Returns an idempotent cleanup function that detaches listeners and closes both endpoints |
| `waitForWebSocketOpen(ws, timeout?)` | Resolve once the socket is `OPEN`; reject on `close` / `error` / timeout (default 5000 ms) |
| `WebSocketLike` | Structural interface matching both the browser `WebSocket` and the Node [`ws`](https://www.npmjs.com/package/ws) package |
| `WS_READY_STATE` | Named `{ CONNECTING, OPEN, CLOSING, CLOSED }` constants, avoiding magic numbers |
| `isWebSocket(obj)` | Structural type guard — anything with `send` + `close` + `readyState` + `addEventListener` passes |

### Typical pattern

```
[caller code]         [caller code]
      │                     │
[MessagePort pair]     [MessagePort pair]
      │ bindWebSocket…      │ bindWebSocket…
      └───── WebSocket ─────┘
               TLS frames
```

Both sides set up a `MessageChannel`, bridge `port1` to the WebSocket,
and hand `port2` to the RPC layer. The bridge ferries every
`port.postMessage(x)` → `ws.send(JSON.stringify(x))` and back.

## Examples

### Client side — one-shot call

```ts
import { bindWebSocketToPort, waitForWebSocketOpen } from "@statewalker/webrun-ports-ws";
import { callPort } from "@statewalker/webrun-ports";

const ws = new WebSocket("ws://localhost:8080");
await waitForWebSocketOpen(ws);

const channel = new MessageChannel();
channel.port1.start();
channel.port2.start();
const closeBridge = bindWebSocketToPort(ws, channel.port1);

try {
  const result = await callPort(channel.port2, { hello: "world" });
  console.log(result);
} finally {
  closeBridge(); // also closes the WebSocket and the port.
}
```

### Server side — Node with the `ws` package

```ts
import { WebSocketServer } from "ws";
import { bindWebSocketToPort, type WebSocketLike } from "@statewalker/webrun-ports-ws";
import { listenPort } from "@statewalker/webrun-ports";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  const channel = new MessageChannel();
  channel.port1.start();
  channel.port2.start();
  const closeBridge = bindWebSocketToPort(ws as unknown as WebSocketLike, channel.port1);
  const closeListener = listenPort(channel.port2, async (params) => ({
    echo: params,
    at: new Date().toISOString(),
  }));
  ws.on("close", () => {
    closeListener();
    closeBridge();
  });
});
```

The `ws` package's `WebSocket` implements `EventTarget` so the structural
`WebSocketLike` cast goes through without further adapters.

### Bidirectional streaming

`bindWebSocketToPort` doesn't know streaming from request/response — so
`callBidi` / `listenBidi` work identically once the port is wired:

```ts
import { callBidi, listenBidi } from "@statewalker/webrun-ports";

// Server
listenBidi(serverPort, async function* (input) {
  for await (const value of input) yield String(value).toUpperCase();
});

// Client — reads N values, sends N values, single socket, no buffering
for await (const upper of callBidi(clientPort, ["hello", "world"])) {
  console.log(upper); // "HELLO", then "WORLD"
}
```

### Binary payloads

`ArrayBuffer` and `Blob` skip the JSON path: they're sent as raw binary
frames and arrive on the peer as a transferable `ArrayBuffer` (no copy).
Mixed traffic — some messages JSON, others binary — just works.

```ts
const transferable = new Uint8Array([1, 2, 3]).buffer;
port.postMessage(transferable, [transferable]);
// …arrives on the peer port as `ArrayBuffer([1,2,3])`.
```

### Multiplexing via channelName

Only one bridge per socket, but `webrun-ports` already multiplexes
sub-protocols via its `channelName` tag. A single WebSocket can carry
several logical RPC channels concurrently without extra plumbing:

```ts
import { callPort, listenPort } from "@statewalker/webrun-ports";

const closeAuth  = listenPort(port, handleAuth,  { channelName: "auth"  });
const closeChat  = listenPort(port, handleChat,  { channelName: "chat"  });
const closeFiles = listenPort(port, handleFiles, { channelName: "files" });

await callPort(peer, creds, { channelName: "auth"  });
await callPort(peer, text,  { channelName: "chat"  });
```

## Internals

### Wire format

Per-message, on each side of the socket:

- **Port → WebSocket**
  - `ArrayBuffer` / `Blob` → sent as-is via `ws.send(data)` (binary frame).
  - Anything else → `JSON.stringify(data)` → sent as text frame.
- **WebSocket → Port**
  - Text frame → `JSON.parse(data)` → `port.postMessage(parsed)`; on
    parse failure, the raw string is posted.
  - `ArrayBuffer` → `port.postMessage(buffer, [buffer])` — transferable.
  - `Blob` → decoded to `ArrayBuffer` via `.arrayBuffer()` then posted as
    transferable.

The webrun-ports envelope (a plain object with `type`, `channelName`,
`callId`, and one of `params` / `result` / `error`) round-trips through
`JSON.stringify` / `JSON.parse` losslessly — every field is JSON-safe.
That's why the bridge needs no envelope-specific knowledge.

### Lifecycle

| Event | Result |
| --- | --- |
| Socket starts `CONNECTING` | Port → WS sends are silently dropped until `OPEN`. Use `waitForWebSocketOpen` upstream. |
| Socket reaches `OPEN` | Traffic flows in both directions. |
| `ws.readyState` ≠ `OPEN` on outbound | Message silently dropped. Matches `callPort`'s contract: pending promises time out. |
| `close` event on the socket | Cleanup runs automatically; the port is closed so pending RPC calls see their timeout. |
| Cleanup function called manually | Detaches listeners, closes the port, and closes the socket if still open. Idempotent. |

### Minimal port-close semantics

The bridge owns the port it's given. `cleanup()` always closes the
`port` passed in. If you need to reuse the port, bridge a fresh
`MessageChannel` each connection (cheap — they're just
`EventTarget`s with a queue).

### Node compatibility

- `MessageChannel` / `MessagePort` are Node globals since 15.x — the
  bridge runs unmodified.
- The `ws` package doesn't provide a DOM-identical `WebSocket` class, but
  it does implement `EventTarget`-style `addEventListener` / `send` /
  `close` / `readyState`. That's enough to satisfy `WebSocketLike`;
  cast with `as unknown as WebSocketLike` and go.
- In-memory tests can use a `FakeWebSocket` that wraps `EventTarget`; see
  [`tests/fake-websocket.ts`](./tests/fake-websocket.ts) for a
  50-line reference implementation (no `ws` dependency).

### Design notes

- **No runtime dependencies.** Platform builtins only (`JSON`, `Blob`,
  `ArrayBuffer`, `MessagePort`, `WebSocket`).
- **Structural type.** `WebSocketLike` avoids naming the concrete class,
  so the same code compiles against browser `WebSocket`, the `ws`
  package, or a test double.
- **No RPC layer.** Helpers like `createWebSocketRpcServer` belong one
  level up — compose `bindWebSocketToPort` with `listenPort` / `callPort`
  or `listenBidi` / `callBidi` as you need.
- **One bridge per socket.** Multiple `bindWebSocketToPort` calls on the
  same `ws` would all receive every inbound message — there's no
  multiplexing at this layer. Use the `webrun-ports` `channelName` tag
  when you need to share a socket between sub-protocols.

### Constraints

- **`.start()` on manual ports.** Ports start paused unless
  `onmessage`-assigned. The bridge calls `.start()` on the port it
  receives; callers must start the peer port themselves.
- **Blobs arrive as ArrayBuffer.** If you send a `Blob`, the peer gets
  an `ArrayBuffer`. Wrap back into a `Blob` explicitly if you need
  Blob-specific semantics on the far side.
- **No automatic reconnection.** The bridge assumes a single connection.
  Reconnect logic (exponential backoff, heartbeat, resume) belongs in
  the layer that opens the socket — rebuild the bridge against the fresh
  `WebSocket` each time.

### Dependencies

**Zero runtime dependencies.**

Dev: TypeScript, vitest, rolldown, rimraf, plus
`@statewalker/webrun-ports` (for tests only).

## Scripts

```sh
pnpm test        # vitest run
pnpm run build   # rolldown + tsc --emitDeclarationOnly
pnpm lint        # biome check src tests
```

## License

MIT © statewalker
