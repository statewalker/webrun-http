# @statewalker/webrun-streams

Tiny async-iterator and `ReadableStream` primitives: a backpressure-aware
queue-based generator, a chunk protocol for pushing iterators across
transports, conversions between async iterators and WHATWG
`ReadableStream<Uint8Array>`, and serialisable `Error` objects.

## Why it exists

Every higher-level package in the `webrun-*` family needs the same four
building blocks:

1. A **callback-to-async-iterator** bridge — turn incoming
   `{done, value, error}` callbacks into a `for await` loop, with proper
   backpressure so producers know when consumers have stopped listening.
2. A **chunk protocol** — a tiny `{done: boolean, value?, error?}`
   envelope that can travel across any transport (MessagePort, WebSocket,
   process pipe, in-memory queue) and rebuild the original iterator on
   the other side.
3. **WHATWG ↔ async-iterator conversions** for body bytes, so code that
   works natively in `fetch` (`ReadableStream<Uint8Array>`) can hand off
   to code that works in `for await … of` loops and back.
4. **Error (de)serialisation** for passing exceptions across structured-
   clone / JSON boundaries without losing stacks or extra fields.

These used to be duplicated across `webrun-ports`, `webrun-http`, and
`webrun-http-browser`. This package is the canonical home; the other
three depend on it.

## How to use

```sh
npm install @statewalker/webrun-streams
```

Five exports:

| Export | Purpose |
| --- | --- |
| `newAsyncGenerator(init, skipValues?)` | Bridge imperative `next/done` callbacks into an `AsyncGenerator<T>`. Each `next(value)` returns `Promise<boolean>` for backpressure. |
| `sendIterator(send, iterable)` | Drain an (async) iterable into `send({done, value, error})` chunk calls; completes with one trailing `{done: true}` chunk. |
| `recieveIterator(installer)` | Inverse of `sendIterator`: wire an installer's chunk callback into a new `AsyncGenerator<T>`. |
| `toReadableStream(it)` | Wrap an `AsyncIterator<Uint8Array>` in a `ReadableStream<Uint8Array>`. |
| `fromReadableStream(stream)` | Iterate a `ReadableStream<Uint8Array>` as `AsyncGenerator<Uint8Array>`. |
| `serializeError(error)` | Turn an `Error` (or anything) into a plain `{message, stack, …}` object preserving subclass fields. |
| `deserializeError(obj \| string)` | Reconstruct an `Error` from a serialised form, restoring extra fields. |

## Examples

### Callback → AsyncGenerator bridge

```ts
import { newAsyncGenerator } from "@statewalker/webrun-streams";

function tickEverySecond(): AsyncGenerator<number> {
  return newAsyncGenerator<number>((next, done) => {
    let n = 0;
    const id = setInterval(() => {
      if (n < 5) void next(n++);
      else {
        void done();
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id); // cleanup if consumer breaks early
  });
}

for await (const n of tickEverySecond()) console.log(n); // 0 … 4
```

### Iterator chunk protocol

```ts
import { sendIterator, recieveIterator } from "@statewalker/webrun-streams";

// Drain an iterable across any transport.
async function transport<T>(chunk: { done: boolean; value?: T; error?: unknown }) {
  // …send `chunk` over your channel.
}
await sendIterator(transport, [1, 2, 3]);

// On the other side, rebuild the original iterator.
const iter = recieveIterator<number>((deliver) => {
  myChannel.onMessage = (chunk) => deliver(chunk);
});
for await (const v of iter) console.log(v); // 1, 2, 3
```

### WHATWG streams ↔ async iterators

```ts
import { fromReadableStream, toReadableStream } from "@statewalker/webrun-streams";

async function* encoded() {
  const e = new TextEncoder();
  yield e.encode("hello ");
  yield e.encode("world");
}

// Give an iterable a ReadableStream face for fetch / Response.
const response = new Response(toReadableStream(encoded()));

// …and the other way around.
const reqBody = new Request("/x", { method: "POST", body: response.body }).body!;
for await (const chunk of fromReadableStream(reqBody)) {
  // chunk: Uint8Array
}
```

### Error roundtrip

```ts
import { serializeError, deserializeError } from "@statewalker/webrun-streams";

class NotFoundError extends Error {
  status = 404;
}

const wire = serializeError(new NotFoundError("missing"));
//    { message: "missing", stack: "…", status: 404 }

const restored = deserializeError(wire) as Error & { status?: number };
console.log(restored instanceof Error); // true
console.log(restored.status);           // 404
```

## Internals

### `newAsyncGenerator` — backpressure queue

A singly-linked queue of slots; each slot carries either a value or a
terminal `{done: true, error?}`. Producers call `next(value)` or
`done(error?)`, both returning `Promise<boolean>` that resolves once the
consumer has dequeued the slot — so producers can apply backpressure by
`await`ing.

If the consumer breaks out of the `for await` early, the finally block
drains remaining slots and resolves each pending `next/done` promise
with `false`, letting the producer observe that its value wasn't
consumed and stop. Cleanup function (if the `init` returned one) runs
on the same exit path.

`skipValues: true` switches the queue into latest-only mode: pushing a
new value drops any unconsumed older ones. Useful for "show the most
recent state" scenarios (live previews, resizing, etc.) where missing
values is fine but lagging isn't.

### Chunk protocol

One object per message:

```
{ done: false, value: T }   — a value
{ done: true,  error?: E }  — termination (error if present rethrows)
```

`sendIterator` guarantees exactly one `done` chunk and never throws
itself — errors from the source iterator end up in the trailing chunk's
`error` field. `recieveIterator` rethrows them into the `for await`
loop on the other side.

### `readable-streams`

`toReadableStream` uses the default (non-byte) ReadableStream type to
sidestep the strict `ArrayBuffer`-not-`SharedArrayBuffer` typing the
byte-controller requires in recent TS libs. Both functions are
strict one-way converters: no queuing strategy tricks, no transform.

### Design notes

- **Zero runtime dependencies.** Only platform builtins
  (`Promise`, `ReadableStream`, `TextEncoder`/`Decoder` if needed,
  `setTimeout` via `newAsyncGenerator` consumers).
- **British/American spelling kept.** `recieveIterator` uses the
  historical misspelling to stay wire-compatible with `webrun-ports`
  consumers.
- **No tight coupling to any transport.** Nothing here mentions
  `MessagePort`, `fetch`, `Worker`, etc. Those belong to the consuming
  packages.

### Constraints

- `toReadableStream` / `fromReadableStream` assume `Uint8Array` chunks —
  the usual shape for HTTP bodies. Generic byte-agnostic use isn't
  supported.
- `newAsyncGenerator`'s backpressure Promise resolves with `false` both
  on early break and on skip; consumers can't distinguish the two.
  That's intentional — both mean "wasn't consumed".

### Dependencies

**Zero runtime dependencies.**

Dev: TypeScript, vitest, rolldown, rimraf, `@types/node`
(catalog versions from the monorepo root).

## Scripts

```sh
pnpm test        # vitest run
pnpm run build   # rolldown + tsc --emitDeclarationOnly
pnpm lint        # biome check
```

## License

MIT © statewalker
