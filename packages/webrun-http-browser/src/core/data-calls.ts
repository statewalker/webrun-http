import { deserializeError, serializeError } from "@statewalker/webrun-streams";
import type { MessageSink, MessageSource } from "./message-target.js";

export type ChannelCallHandler = (
  event: MessageEvent,
  params: unknown,
  ...transfers: MessagePort[]
) => unknown;

export function callChannel<T = unknown>(
  target: MessageSink,
  callType: string,
  params: unknown,
  ...transfers: Transferable[]
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (ev: MessageEvent) => {
      const { result, error } = ev.data as { result?: T; error?: unknown };
      if (error) reject(deserializeError(error as never));
      else resolve(result as T);
    };
    target.postMessage({ type: callType, params }, [channel.port2, ...transfers]);
  });
}

export function handleChannelCalls(
  target: MessageSource,
  callType: string,
  handler: ChannelCallHandler,
): () => void {
  const listener = async (event: MessageEvent) => {
    if (!event.data || event.data.type !== callType) return;
    const [port, ...transfers] = event.ports ?? [];
    const response: { result?: unknown; error?: unknown } = {};
    try {
      response.result = await handler(event, event.data.params, ...transfers);
    } catch (error) {
      response.error = serializeError(error);
    }
    port?.postMessage(response);
  };
  target.addEventListener("message", listener);
  target.start?.();
  return () => target.removeEventListener("message", listener);
}
