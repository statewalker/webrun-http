import { describe, expect, it } from "vitest";
import { fromReadableStream, toReadableStream } from "../src/readable-streams.js";

describe("readable-streams", () => {
  it("roundtrips chunks through toReadableStream → fromReadableStream", async () => {
    const encoder = new TextEncoder();
    async function* source() {
      yield encoder.encode("hello ");
      yield encoder.encode("world");
    }
    const stream = toReadableStream(source());
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    for await (const chunk of fromReadableStream(stream)) chunks.push(decoder.decode(chunk));
    expect(chunks.join("")).toBe("hello world");
  });

  it("propagates iterator errors to the stream consumer", async () => {
    async function* bomb() {
      yield new Uint8Array([1]);
      throw new Error("iterator failed");
    }
    const reader = toReadableStream(bomb()).getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(first.value).toEqual(new Uint8Array([1]));
    await expect(reader.read()).rejects.toThrow("iterator failed");
  });

  it("emits nothing for an empty iterator", async () => {
    async function* empty() {}
    const got: Uint8Array[] = [];
    for await (const chunk of fromReadableStream(toReadableStream(empty()))) got.push(chunk);
    expect(got).toEqual([]);
  });
});
