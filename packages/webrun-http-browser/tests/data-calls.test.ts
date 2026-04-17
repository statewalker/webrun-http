import { describe, expect, it } from "vitest";
import { callChannel, handleChannelCalls } from "../src/core/data-calls.js";
import type { MessageTarget } from "../src/core/message-target.js";

function asTarget(port: MessagePort): MessageTarget {
  return port as unknown as MessageTarget;
}

describe("callChannel / handleChannelCalls", () => {
  it("delivers params and returns handler result", async () => {
    const { port1, port2 } = new MessageChannel();
    const cleanup = handleChannelCalls(asTarget(port1), "ADD", (_event, params) => {
      const { a, b } = params as { a: number; b: number };
      return a + b;
    });
    try {
      const result = await callChannel<number>(asTarget(port2), "ADD", { a: 2, b: 3 });
      expect(result).toBe(5);
    } finally {
      cleanup();
      port1.close();
      port2.close();
    }
  });

  it("ignores messages with non-matching call type", async () => {
    const { port1, port2 } = new MessageChannel();
    const adder = handleChannelCalls(asTarget(port1), "ADD", (_e, params) => {
      const { a, b } = params as { a: number; b: number };
      return a + b;
    });
    const multiplier = handleChannelCalls(asTarget(port1), "MUL", (_e, params) => {
      const { a, b } = params as { a: number; b: number };
      return a * b;
    });
    try {
      expect(await callChannel<number>(asTarget(port2), "ADD", { a: 2, b: 3 })).toBe(5);
      expect(await callChannel<number>(asTarget(port2), "MUL", { a: 2, b: 3 })).toBe(6);
    } finally {
      adder();
      multiplier();
      port1.close();
      port2.close();
    }
  });

  it("propagates handler errors to the caller", async () => {
    const { port1, port2 } = new MessageChannel();
    const cleanup = handleChannelCalls(asTarget(port1), "BOOM", () => {
      throw new Error("kaboom");
    });
    try {
      await expect(callChannel(asTarget(port2), "BOOM", {})).rejects.toThrow("kaboom");
    } finally {
      cleanup();
      port1.close();
      port2.close();
    }
  });

  it("forwards transferred ports to the handler", async () => {
    const { port1: callerA, port2: calleeA } = new MessageChannel();
    const transfer = new MessageChannel();
    const cleanup = handleChannelCalls(asTarget(calleeA), "ECHO", (_event, _params, port) => {
      port.postMessage("hi");
      return true;
    });
    try {
      const received = new Promise<string>((resolve) => {
        transfer.port1.onmessage = (ev) => resolve(ev.data as string);
      });
      await callChannel(asTarget(callerA), "ECHO", {}, transfer.port2);
      expect(await received).toBe("hi");
    } finally {
      cleanup();
      callerA.close();
      calleeA.close();
      transfer.port1.close();
    }
  });
});
