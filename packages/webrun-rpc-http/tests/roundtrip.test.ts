import { describe, expect, it } from "vitest";
import { newRpcClient } from "../src/new-rpc-client.js";
import { newRpcServer } from "../src/new-rpc-server.js";

class MathService {
  async add(params: { a: number; b: number }) {
    return params.a + params.b;
  }
  async fail() {
    throw new Error("server blew up");
  }
  async reverse(_params: unknown, body?: Blob) {
    if (!body) throw new Error("no body");
    const bytes = new Uint8Array(await body.arrayBuffer());
    return new Blob([bytes.reverse()]);
  }
}

/**
 * Pipe a webrun-http server handler directly into the client's fetch hook —
 * no actual network socket needed.
 */
function wireClientToServer(services: Record<string, object>) {
  const handler = newRpcServer(services);
  return newRpcClient({
    baseUrl: "http://in-process",
    fetch: (request) => handler(request),
  });
}

describe("client ↔ server round trip", () => {
  it("decodes a JSON result end to end", async () => {
    const client = wireClientToServer({ math: new MathService() });
    const svc = await client.loadService<MathService>("math");
    const result = await svc.add({ a: 2, b: 3 });
    expect(result).toBe(5);
  });

  it("rethrows a deserialized error when the remote method throws", async () => {
    const client = wireClientToServer({ math: new MathService() });
    const svc = await client.loadService<MathService>("math");
    await expect(svc.fail()).rejects.toThrow("server blew up");
  });

  it("round-trips a Blob body both ways", async () => {
    const client = wireClientToServer({ math: new MathService() });
    const svc = await client.loadService<MathService>("math");
    const result = (await svc.reverse({}, new Blob([new Uint8Array([1, 2, 3, 4])]))) as Blob;
    const bytes = new Uint8Array(await result.arrayBuffer());
    expect(Array.from(bytes)).toEqual([4, 3, 2, 1]);
  });

  it("caches the descriptor across multiple method calls", async () => {
    let descriptorCalls = 0;
    const handler = newRpcServer({ math: new MathService() });
    const client = newRpcClient({
      baseUrl: "http://in-process",
      fetch: async (request) => {
        if (new URL(request.url).pathname === "/") descriptorCalls++;
        return handler(request);
      },
    });
    const svc = await client.loadService<MathService>("math");
    await svc.add({ a: 1, b: 2 });
    await svc.add({ a: 3, b: 4 });
    expect(descriptorCalls).toBe(1);
  });
});
