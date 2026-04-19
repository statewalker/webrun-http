import { describe, expect, it } from "vitest";
import { collect, collectBytes } from "../src/collect.js";
import {
  decodeFloat32Arrays,
  decodeMsgpack,
  encodeFloat32Arrays,
  encodeMsgpack,
} from "../src/msgpack.js";

async function* from<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

describe("msgpack streaming", () => {
  it("round-trips simple objects", async () => {
    const original = [{ a: 1 }, { b: "hello" }, { c: [1, 2, 3] }];
    const decoded = await collect(
      decodeMsgpack<(typeof original)[number]>(encodeMsgpack(from(original))),
    );
    expect(decoded).toEqual(original);
  });

  it("round-trips primitives", async () => {
    const original = [42, "hello", true, null, -100, 3.14];
    const decoded = await collect(
      decodeMsgpack<(typeof original)[number]>(encodeMsgpack(from(original))),
    );
    // Note: 3.14 may have float precision issues, compare loosely
    expect(decoded.length).toBe(original.length);
    expect(decoded[0]).toBe(42);
    expect(decoded[1]).toBe("hello");
    expect(decoded[2]).toBe(true);
    expect(decoded[3]).toBe(null);
    expect(decoded[4]).toBe(-100);
    expect(decoded[5]).toBeCloseTo(3.14, 10);
  });

  it("round-trips nested objects", async () => {
    const original = [
      {
        user: { name: "Alice", tags: ["admin", "user"] },
        count: 42,
      },
    ];
    const decoded = await collect(
      decodeMsgpack<(typeof original)[number]>(encodeMsgpack(from(original))),
    );
    expect(decoded).toEqual(original);
  });

  it("handles empty stream", async () => {
    const decoded = await collect(decodeMsgpack(encodeMsgpack(from([]))));
    expect(decoded).toEqual([]);
  });

  it("handles frames split across chunks", async () => {
    const original = [{ data: "hello world" }, { data: "test" }];
    // Encode to a single buffer, then split into small chunks
    const fullBytes = await collectBytes(encodeMsgpack(from(original)));

    // Split into 3-byte chunks to force frame boundary splits
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullBytes.length; i += 3) {
      chunks.push(fullBytes.subarray(i, Math.min(i + 3, fullBytes.length)));
    }

    const decoded = await collect(
      decodeMsgpack<{ data: string }>(from(chunks)),
    );
    expect(decoded).toEqual(original);
  });

  it("handles large payloads", async () => {
    const largeString = "x".repeat(100_000);
    const original = [{ data: largeString }];
    const decoded = await collect(
      decodeMsgpack<{ data: string }>(encodeMsgpack(from(original))),
    );
    expect(decoded[0]?.data.length).toBe(100_000);
  });

  it("handles multiple values in sequence", async () => {
    const values = Array.from({ length: 100 }, (_, i) => ({ idx: i }));
    const decoded = await collect(
      decodeMsgpack<{ idx: number }>(encodeMsgpack(from(values))),
    );
    expect(decoded).toEqual(values);
  });
});

describe("Float32Array streaming", () => {
  it("round-trips Float32Arrays", async () => {
    const original = [
      new Float32Array([0.1, 0.2, 0.3]),
      new Float32Array([1.5, 2.5]),
    ];
    const decoded = await collect(
      decodeFloat32Arrays(encodeFloat32Arrays(from(original))),
    );
    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toBeInstanceOf(Float32Array);
    expect(decoded[0]?.length).toBe(3);
    expect(decoded[1]?.length).toBe(2);
    // Compare values — Float32 precision
    for (let i = 0; i < 3; i++) {
      expect(decoded[0]?.[i]).toBeCloseTo(original[0]?.[i] ?? 0, 5);
    }
  });

  it("preserves bit-identical values", async () => {
    const original = [new Float32Array([Math.PI, -0, Number.EPSILON])];
    const decoded = await collect(
      decodeFloat32Arrays(encodeFloat32Arrays(from(original))),
    );
    expect(decoded[0]?.[0]).toBe(original[0]?.[0]);
    expect(Object.is(decoded[0]?.[1], -0)).toBe(true);
    expect(decoded[0]?.[2]).toBe(Number.EPSILON);
  });

  it("handles large arrays", async () => {
    const large = new Float32Array(10_000);
    for (let i = 0; i < large.length; i++) large[i] = Math.random();
    const decoded = await collect(
      decodeFloat32Arrays(encodeFloat32Arrays(from([large]))),
    );
    expect(decoded[0]?.length).toBe(10_000);
  });

  it("handles empty arrays", async () => {
    const decoded = await collect(
      decodeFloat32Arrays(encodeFloat32Arrays(from([new Float32Array(0)]))),
    );
    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.length).toBe(0);
  });

  it("handles frames split across chunks", async () => {
    const original = [new Float32Array([1.0, 2.0]), new Float32Array([3.0])];
    const fullBytes = await collectBytes(encodeFloat32Arrays(from(original)));

    // Split into 5-byte chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullBytes.length; i += 5) {
      chunks.push(fullBytes.subarray(i, Math.min(i + 5, fullBytes.length)));
    }

    const decoded = await collect(decodeFloat32Arrays(from(chunks)));
    expect(decoded).toHaveLength(2);
    expect(decoded[0]?.[0]).toBe(1.0);
    expect(decoded[0]?.[1]).toBe(2.0);
    expect(decoded[1]?.[0]).toBe(3.0);
  });
});
