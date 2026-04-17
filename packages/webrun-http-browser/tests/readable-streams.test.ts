import { describe, expect, it } from "vitest";
import { fromReadableStream, toReadableStream } from "../src/http/readable-streams.js";

describe("readable-streams", () => {
  it("roundtrips chunks through toReadableStream / fromReadableStream", async () => {
    const encoder = new TextEncoder();
    async function* source() {
      yield encoder.encode("hello ");
      yield encoder.encode("world");
    }
    const stream = toReadableStream(source());
    const chunks: Uint8Array[] = [];
    for await (const chunk of fromReadableStream(stream)) chunks.push(chunk);
    const decoder = new TextDecoder();
    expect(chunks.map((c) => decoder.decode(c)).join("")).toBe("hello world");
  });

  it("propagates iterator errors to the stream consumer", async () => {
    async function* bomb() {
      yield new Uint8Array([1]);
      throw new Error("iterator failed");
    }
    const stream = toReadableStream(bomb());
    const reader = stream.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(first.value).toEqual(new Uint8Array([1]));
    await expect(reader.read()).rejects.toThrow("iterator failed");
  });

  it("emits no values for an empty iterator", async () => {
    async function* empty() {}
    const stream = toReadableStream(empty());
    const got: Uint8Array[] = [];
    for await (const chunk of fromReadableStream(stream)) got.push(chunk);
    expect(got).toEqual([]);
  });
});
