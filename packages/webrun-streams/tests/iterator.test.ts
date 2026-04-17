import { describe, expect, it } from "vitest";
import { recieveIterator } from "../src/recieve-iterator.js";
import type { IteratorChunk } from "../src/send-iterator.js";
import { sendIterator } from "../src/send-iterator.js";

describe("sendIterator", () => {
  it("emits one chunk per value plus a trailing done", async () => {
    const chunks: IteratorChunk<number>[] = [];
    await sendIterator<number>(
      async (c) => {
        chunks.push(c);
      },
      [1, 2, 3],
    );
    expect(chunks).toEqual([
      { done: false, value: 1 },
      { done: false, value: 2 },
      { done: false, value: 3 },
      { done: true, error: undefined },
    ]);
  });

  it("emits only a done chunk for an empty input", async () => {
    const chunks: IteratorChunk<number>[] = [];
    await sendIterator<number>(async (c) => {
      chunks.push(c);
    }, []);
    expect(chunks).toEqual([{ done: true, error: undefined }]);
  });

  it("attaches the thrown error to the done chunk instead of throwing", async () => {
    const chunks: IteratorChunk<number>[] = [];
    const bomb = (async function* () {
      yield 1;
      throw new Error("boom");
    })();
    await sendIterator<number>(async (c) => {
      chunks.push(c);
    }, bomb);
    expect(chunks[0]).toEqual({ done: false, value: 1 });
    expect(chunks[1].done).toBe(true);
    expect(chunks[1].error).toBeInstanceOf(Error);
    expect((chunks[1].error as Error).message).toBe("boom");
  });

  it("accepts async iterables", async () => {
    async function* source() {
      yield "a";
      yield "b";
    }
    const chunks: IteratorChunk<string>[] = [];
    await sendIterator<string>(async (c) => {
      chunks.push(c);
    }, source());
    expect(chunks).toEqual([
      { done: false, value: "a" },
      { done: false, value: "b" },
      { done: true, error: undefined },
    ]);
  });
});

describe("recieveIterator", () => {
  it("rebuilds an async iterator from chunk callbacks", async () => {
    const iter = recieveIterator<number>((deliver) => {
      (async () => {
        for (const v of [10, 20, 30]) await deliver({ done: false, value: v });
        await deliver({ done: true });
      })();
    });
    const out: number[] = [];
    for await (const v of iter) out.push(v);
    expect(out).toEqual([10, 20, 30]);
  });

  it("rethrows the error forwarded in the done chunk", async () => {
    const err = new Error("propagated");
    const iter = recieveIterator<number>((deliver) => {
      (async () => {
        await deliver({ done: false, value: 1 });
        await deliver({ done: true, error: err });
      })();
    });
    const seen: number[] = [];
    await expect(
      (async () => {
        for await (const v of iter) seen.push(v);
      })(),
    ).rejects.toBe(err);
    expect(seen).toEqual([1]);
  });

  it("calls the installer's cleanup when the consumer breaks", async () => {
    let cleaned = false;
    const iter = recieveIterator<number>((deliver) => {
      (async () => {
        for (let i = 0; i < 5; i++) {
          const ok = await deliver({ done: false, value: i });
          if (!ok) break;
        }
        await deliver({ done: true });
      })();
      return () => {
        cleaned = true;
      };
    });
    const seen: number[] = [];
    for await (const v of iter) {
      seen.push(v);
      if (v === 1) break;
    }
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([0, 1]);
    expect(cleaned).toBe(true);
  });
});

describe("sendIterator + recieveIterator roundtrip", () => {
  it("drains then reconstructs an identical sequence", async () => {
    const chunks: IteratorChunk<string>[] = [];
    await sendIterator<string>(
      async (c) => {
        chunks.push(c);
      },
      ["alpha", "beta", "gamma"],
    );

    const iter = recieveIterator<string>((deliver) => {
      (async () => {
        for (const c of chunks) await deliver(c);
      })();
    });
    const out: string[] = [];
    for await (const v of iter) out.push(v);
    expect(out).toEqual(["alpha", "beta", "gamma"]);
  });
});
