import { describe, expect, it } from "vitest";
import { waitForWebSocketOpen } from "../src/wait-open.js";
import { WS_READY_STATE } from "../src/websocket-like.js";
import { createFakeWebSocketPair, FakeWebSocket } from "./fake-websocket.js";

describe("waitForWebSocketOpen", () => {
  it("resolves immediately when the socket is already open", async () => {
    const pair = createFakeWebSocketPair();
    pair[0].open();
    await expect(waitForWebSocketOpen(pair[0])).resolves.toBeUndefined();
  });

  it("resolves when the socket opens later", async () => {
    const pair = createFakeWebSocketPair();
    const promise = waitForWebSocketOpen(pair[0]);
    queueMicrotask(() => pair[0].open());
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when the socket errors out before opening", async () => {
    const pair = createFakeWebSocketPair();
    const promise = waitForWebSocketOpen(pair[0]);
    queueMicrotask(() => pair[0].fail());
    await expect(promise).rejects.toThrow("WebSocket connection failed");
  });

  it("rejects once the timeout elapses", async () => {
    const pair = createFakeWebSocketPair();
    await expect(waitForWebSocketOpen(pair[0], 20)).rejects.toThrow("WebSocket open timeout");
  });

  it("rejects when the socket is already closed", async () => {
    const ws = new FakeWebSocket();
    ws.readyState = WS_READY_STATE.CLOSED;
    await expect(waitForWebSocketOpen(ws)).rejects.toThrow("closed or closing");
  });
});
