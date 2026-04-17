import { deserializeError, type SerializedError } from "@statewalker/webrun-streams";

export interface CallPortOptions {
  /** Timeout in ms after which the call rejects (default 1000). */
  timeout?: number;
  /** Channel name filter — peers with a different `channelName` ignore the message. */
  channelName?: string;
  /** Logging function; defaults to a no-op. */
  log?: (...args: unknown[]) => void;
  /** Override the call ID generator (default: `call-<timestamp>-<random>`). */
  newCallId?: () => string;
}

type ResponseEnvelope<T> =
  | { type: "response:result"; channelName: string; callId: string; result: T }
  | { type: "response:error"; channelName: string; callId: string; error: SerializedError };

/**
 * Asynchronous request/response over a `MessagePort`.
 *
 * Sends `params` to the peer listening with `listenPort`, waits up to
 * `timeout` ms for a matching reply, and either resolves with the result or
 * rejects with the deserialised error.
 */
export function callPort<TResult = unknown, TParams = unknown>(
  port: MessagePort,
  params: TParams,
  {
    timeout = 1000,
    channelName = "",
    log = () => {},
    newCallId = () => `call-${Date.now()}-${String(Math.random()).substring(2)}`,
  }: CallPortOptions = {},
): Promise<TResult> {
  const callId = newCallId();
  log("[callPort]", { channelName, callId, params });
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let onMessage: ((event: MessageEvent) => void) | undefined;
  const promise = new Promise<TResult>((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error(`Call timeout. CallId: "${callId}".`)), timeout);
    onMessage = (event: MessageEvent) => {
      const data = event.data as ResponseEnvelope<TResult> | undefined;
      if (!data) return;
      if (data.channelName !== channelName) return;
      if (data.callId !== callId) return;
      if (data.type === "response:error") reject(deserializeError(data.error));
      else if (data.type === "response:result") resolve(data.result);
    };
    port.addEventListener("message", onMessage);
  });
  // Swallow rejection on this side-branch so the cleanup .finally doesn't
  // surface an unhandled rejection. The original `promise` keeps its
  // rejection for the caller.
  promise
    .catch(() => {})
    .finally(() => {
      if (timerId !== undefined) clearTimeout(timerId);
      if (onMessage) port.removeEventListener("message", onMessage);
    });
  port.postMessage({ type: "request", channelName, callId, params });
  return promise;
}
