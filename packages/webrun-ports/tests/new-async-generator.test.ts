import { describe, expect, it } from "vitest";
import { newAsyncGenerator } from "../src/new-async-generator.js";

async function delay(ms = 0): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe("newAsyncGenerator (smoke)", () => {
  it("forwards synchronous producer values to the consumer", async () => {
    const produced: number[] = [];
    const gen = newAsyncGenerator<number>((next, done) => {
      for (const v of [1, 2, 3]) {
        produced.push(v);
        void next(v);
      }
      void done();
    });
    const seen: number[] = [];
    for await (const v of gen) seen.push(v);
    expect(seen).toEqual([1, 2, 3]);
    expect(produced).toEqual([1, 2, 3]);
  });

  it("rethrows an error passed to done()", async () => {
    const boom = new Error("nope");
    const gen = newAsyncGenerator<number>((next, done) => {
      (async () => {
        await next(1);
        await done(boom);
      })();
    });
    const seen: number[] = [];
    await expect(
      (async () => {
        for await (const v of gen) seen.push(v);
      })(),
    ).rejects.toBe(boom);
    expect(seen).toEqual([1]);
  });

  it("calls the cleanup function on early break", async () => {
    let cleaned = false;
    const gen = newAsyncGenerator<number>((next, done) => {
      (async () => {
        for (let i = 0; i < 10; i++) await next(i);
        await done();
      })();
      return () => {
        cleaned = true;
      };
    });
    const seen: number[] = [];
    for await (const v of gen) {
      seen.push(v);
      if (v === 2) break;
    }
    await delay(10);
    expect(seen).toEqual([0, 1, 2]);
    expect(cleaned).toBe(true);
  });
});
