# @repo/streams

Composable async stream utilities for transforming, encoding, and framing `AsyncIterable` data. All functions are pure — they accept `AsyncIterable<T>` and return `AsyncGenerator<T>` — making them freely composable into streaming pipelines with no intermediate buffering.

## Why it exists

The content-scanner pipeline passes data between stages as `AsyncGenerator<Uint8Array>`. Without shared utilities, every stage re-invented serialization inline: `JSON.stringify` + `TextEncoder` for objects, custom length-prefixed formats for embeddings, `collectBytes` for buffering. This package extracts those patterns into reusable, composable stream transforms and provides standard framing via MessagePack.

## How to use

```typescript
import {
  map, decodeText, encodeText,
  splitLines, joinLines,
  encodeJsonl, decodeJsonl,
  encodeMsgpack, decodeMsgpack,
  encodeFloat32Arrays, decodeFloat32Arrays,
  collect, collectBytes, collectString,
} from "@repo/streams";
```

## Examples

### Transform

```typescript
// Double each number in a stream
const doubled = map(numberStream, (n) => n * 2);

// Async mapper
const fetched = map(urlStream, async (url) => await fetch(url));
```

### Text encoding

```typescript
// Bytes → string (handles split multi-byte UTF-8)
const strings = decodeText(byteStream);

// String → bytes
const bytes = encodeText(stringStream);
```

### Line splitting

```typescript
// String stream → one string per line
const lines = splitLines(stringStream);

// Add \n to each string
const terminated = joinLines(stringStream);
```

### JSONL (JSON Lines)

```typescript
// Objects → JSONL string stream (one JSON per line)
const jsonl = encodeJsonl(objectStream);

// JSONL string stream → objects
const objects = decodeJsonl<MyType>(stringStream);

// Full pipeline: objects → JSONL → UTF-8 bytes
const bytes = encodeText(encodeJsonl(objectStream));
```

### MessagePack framing

```typescript
// Objects → length-prefixed msgpack frames
const frames = encodeMsgpack(objectStream);

// Frames → objects (handles split across chunks)
const objects = decodeMsgpack<MyType>(frameStream);
```

### Float32Array streaming

```typescript
// Float32Array[] → msgpack binary frames (zero-copy)
const frames = encodeFloat32Arrays(embeddingStream);

// Frames → Float32Array[]
const arrays = decodeFloat32Arrays(frameStream);
```

### Collect (boundary utilities)

```typescript
const items = await collect(stream);           // T[] 
const bytes = await collectBytes(byteStream);  // single Uint8Array
const text = await collectString(stringStream); // single string
```

### Composed pipelines

```typescript
// Read file bytes → decode text → split lines → parse JSON per line
const records = decodeJsonl<Record>(
  splitLines(
    decodeText(fileByteStream)
  )
);

// Objects → msgpack frames → write to store
for await (const frame of encodeMsgpack(objectStream)) {
  await store.write(frame);
}
```

## Internals

### File structure

```
src/
├── map.ts       — map() transform
├── text.ts      — decodeText(), encodeText()
├── lines.ts     — splitLines(), joinLines()
├── collect.ts   — collect(), collectBytes(), collectString()
├── jsonl.ts     — encodeJsonl(), decodeJsonl()
├── msgpack.ts   — encodeMsgpack(), decodeMsgpack(), encodeFloat32Arrays(), decodeFloat32Arrays()
└── index.ts     — barrel exports
```

### MessagePack framing

`encodeMsgpack` / `decodeMsgpack` use length-prefixed framing to stream multiple values:

```
[4-byte BE length][msgpack bytes][4-byte BE length][msgpack bytes]...
```

Each value is serialized via `@ygoe/msgpack` (standard MessagePack spec, no custom ext types). `decodeMsgpack` reassembles frames that are split across input chunks.

### Float32Array encoding

`encodeFloat32Arrays` converts each `Float32Array` to a `Uint8Array` view of the same `ArrayBuffer` (zero-copy), then encodes it as a msgpack `bin` value inside a length-prefixed frame. `decodeFloat32Arrays` decodes the `bin` and wraps the result as a `Float32Array` view, handling buffer alignment.

No custom MessagePack ext types are used — typed arrays are handled at the application level via standard `bin` format.

### Dependencies

- `@ygoe/msgpack` v1.0.3 — standard MessagePack serialize/deserialize (MIT, by Yves Goergen)

## License

MIT
