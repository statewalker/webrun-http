import { callPort, listenPort } from "@statewalker/webrun-ports";
import { describe, expect, it } from "vitest";
import { bindWebSocketToPort } from "../src/bind-port.js";
import { WS_READY_STATE } from "../src/websocket-like.js";
import { createFakeWebSocketPair, openPair } from "./fake-websocket.js";

/**
 * Stand up a full client↔server loop: server = (ws2 ↔ port2a) + listenPort on
 * port2b; client = (ws1 ↔ port1a) + callPort on port1b.
 */
function newBridgedChannels() {
  const pair = createFakeWebSocketPair();
  openPair(pair);
  const [wsA, wsB] = pair;
  const clientChannel = new MessageChannel();
  const serverChannel = new MessageChannel();
  clientChannel.port1.start();
  clientChannel.port2.start();
  serverChannel.port1.start();
  serverChannel.port2.start();
  const closeClient = bindWebSocketToPort(wsA, clientChannel.port1);
  const closeServer = bindWebSocketToPort(wsB, serverChannel.port1);
  return {
    clientPort: clientChannel.port2,
    serverPort: serverChannel.port2,
    wsA,
    wsB,
    cleanup: () => {
      closeClient();
      closeServer();
    },
  };
}

describe("bindWebSocketToPort", () => {
  it("routes a callPort/listenPort round trip over the bridge", async () => {
    const { clientPort, serverPort, cleanup } = newBridgedChannels();
    const stopServer = listenPort(serverPort, async (params) => ({ echo: params }));
    try {
      const result = await callPort(clientPort, { hello: "world" }, { timeout: 500 });
      expect(result).toEqual({ echo: { hello: "world" } });
    } finally {
      stopServer();
      cleanup();
    }
  });

  it("propagates serialized errors across the bridge", async () => {
    const { clientPort, serverPort, cleanup } = newBridgedChannels();
    const stopServer = listenPort(serverPort, async () => {
      throw new Error("bridged failure");
    });
    try {
      await expect(callPort(clientPort, {}, { timeout: 500 })).rejects.toThrow("bridged failure");
    } finally {
      stopServer();
      cleanup();
    }
  });

  it("forwards ArrayBuffer payloads as transferables", async () => {
    const [wsA, wsB] = (() => {
      const pair = createFakeWebSocketPair();
      openPair(pair);
      return pair;
    })();
    const channelA = new MessageChannel();
    const channelB = new MessageChannel();
    channelA.port1.start();
    channelA.port2.start();
    channelB.port1.start();
    channelB.port2.start();
    const closeA = bindWebSocketToPort(wsA, channelA.port1);
    const closeB = bindWebSocketToPort(wsB, channelB.port1);
    try {
      const received = new Promise<ArrayBuffer>((resolve) => {
        channelB.port2.addEventListener("message", (event) => resolve(event.data));
      });
      const out = new Uint8Array([1, 2, 3, 4]).buffer;
      channelA.port2.postMessage(out, [out]);
      const buf = await received;
      expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3, 4]));
    } finally {
      closeA();
      closeB();
    }
  });

  it("cleanup closes both the socket and the port", () => {
    const pair = createFakeWebSocketPair();
    openPair(pair);
    const [wsA] = pair;
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    const close = bindWebSocketToPort(wsA, channel.port1);
    close();
    expect(wsA.readyState).toBe(WS_READY_STATE.CLOSED);
  });

  it("closes the port when the socket closes", async () => {
    const pair = createFakeWebSocketPair();
    openPair(pair);
    const [wsA, wsB] = pair;
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    bindWebSocketToPort(wsA, channel.port1);
    wsB.close();
    // Allow the close event to propagate.
    await new Promise((r) => setTimeout(r, 0));
    expect(wsA.readyState).toBe(WS_READY_STATE.CLOSED);
  });

  it("drops messages when the socket is not OPEN", () => {
    const pair = createFakeWebSocketPair();
    const [wsA] = pair;
    // Bridge while still CONNECTING — messages should be silently dropped.
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    const close = bindWebSocketToPort(wsA, channel.port1);
    expect(() => channel.port2.postMessage({ type: "dropped" })).not.toThrow();
    close();
  });
});
