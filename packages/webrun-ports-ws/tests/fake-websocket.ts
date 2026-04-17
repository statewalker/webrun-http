import { type WebSocketLike, WS_READY_STATE } from "../src/websocket-like.js";

/**
 * Minimal in-memory WebSocket pair for tests. Each side is a `WebSocketLike`
 * that dispatches its outbound `send` as a `message` event on its peer.
 *
 * The pair starts in `CONNECTING`; call {@link open} to flip both to `OPEN`
 * (and fire the paired `open` events).
 */
export class FakeWebSocket extends EventTarget implements WebSocketLike {
  readyState: number = WS_READY_STATE.CONNECTING;
  peer: FakeWebSocket | null = null;

  send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== WS_READY_STATE.OPEN) {
      throw new Error("WebSocket is not open");
    }
    const peer = this.peer;
    if (!peer) return;
    queueMicrotask(() => {
      if (peer.readyState !== WS_READY_STATE.OPEN) return;
      peer.dispatchEvent(new MessageEvent("message", { data }));
    });
  }

  close(): void {
    if (this.readyState === WS_READY_STATE.CLOSED) return;
    this.readyState = WS_READY_STATE.CLOSED;
    this.dispatchEvent(new Event("close"));
    const peer = this.peer;
    if (peer && peer.readyState !== WS_READY_STATE.CLOSED) {
      peer.readyState = WS_READY_STATE.CLOSED;
      peer.dispatchEvent(new Event("close"));
    }
  }

  fail(): void {
    this.readyState = WS_READY_STATE.CLOSED;
    this.dispatchEvent(new Event("error"));
  }

  open(): void {
    if (this.readyState !== WS_READY_STATE.CONNECTING) return;
    this.readyState = WS_READY_STATE.OPEN;
    this.dispatchEvent(new Event("open"));
  }
}

export function createFakeWebSocketPair(): [FakeWebSocket, FakeWebSocket] {
  const a = new FakeWebSocket();
  const b = new FakeWebSocket();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

/** Open both sides of a pair. */
export function openPair(pair: [FakeWebSocket, FakeWebSocket]): void {
  pair[0].open();
  pair[1].open();
}
