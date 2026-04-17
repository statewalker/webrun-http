import {
  deserializeError,
  recieveIterator,
  type SerializedError,
  sendIterator,
  serializeError,
} from "@statewalker/webrun-streams";
import type { MessageTarget } from "./message-target.js";

const MESSAGE_TYPE_REQUEST = "REQUEST";
const MESSAGE_TYPE_RESPONSE = "RESPONSE";

type InvocationMessage =
  | { type: typeof MESSAGE_TYPE_REQUEST; callId: number; request: unknown }
  | {
      type: typeof MESSAGE_TYPE_RESPONSE;
      callId: number;
      response?: unknown;
      error?: SerializedError;
    };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

let __invocationCounter = 0;

export interface InvocationChannel {
  start(): Promise<void>;
  close(): Promise<void>;
  invoke<T = unknown>(request?: unknown, ...transfers: Transferable[]): Promise<T>;
}

export interface NewInvocationChannelOptions {
  port: MessageTarget;
  handler?: (request: unknown, ...ports: MessagePort[]) => unknown;
  onError?: (error: unknown) => void;
  newCallId?: () => number;
}

export function newInvokationChannel({
  port,
  handler = () => {
    throw new Error("Handler not implemented");
  },
  onError = console.error,
  newCallId = () => ++__invocationCounter,
}: NewInvocationChannelOptions): InvocationChannel {
  const requests: Record<number, PendingRequest> = {};

  const listener = async (event: MessageEvent) => {
    const data = (event.data ?? {}) as InvocationMessage;
    if (data.type === MESSAGE_TYPE_REQUEST) {
      try {
        const result = await handler(data.request, ...(event.ports as MessagePort[]));
        const [response, ...transfers] = Array.isArray(result)
          ? (result as unknown[])
          : result !== undefined
            ? [result]
            : [];
        port.postMessage(
          { type: MESSAGE_TYPE_RESPONSE, callId: data.callId, response },
          transfers as Transferable[],
        );
      } catch (error) {
        port.postMessage({
          type: MESSAGE_TYPE_RESPONSE,
          callId: data.callId,
          error: serializeError(error),
        });
      }
    } else if (data.type === MESSAGE_TYPE_RESPONSE) {
      const pending = requests[data.callId];
      delete requests[data.callId];
      if (!pending) return;
      if (data.error) pending.reject(deserializeError(data.error));
      else pending.resolve(data.response);
    }
  };

  const start = async () => {
    try {
      port.addEventListener("message", listener);
      await port.start?.();
    } catch (e) {
      onError(e);
    }
  };

  const close = async () => {
    try {
      port.removeEventListener("message", listener);
      await port.close?.();
    } catch (e) {
      onError(e);
    }
  };

  const invoke = <T>(request: unknown = {}, ...transfers: Transferable[]): Promise<T> => {
    const callId = newCallId();
    return new Promise<T>((resolve, reject) => {
      try {
        requests[callId] = {
          resolve: resolve as (value: unknown) => void,
          reject,
        };
        port.postMessage({ type: MESSAGE_TYPE_REQUEST, callId, request }, transfers);
      } catch (error) {
        delete requests[callId];
        reject(error);
      }
    });
  };

  return { start, close, invoke };
}

export async function* sendStream<T>(
  communicationPort: MessageTarget,
  input: AsyncIterable<T>,
  params: Record<string, unknown> = {},
): AsyncGenerator<T, void, unknown> {
  const messageChannel = new MessageChannel();
  communicationPort.postMessage({ type: "START_CALL", params }, [messageChannel.port2]);

  const channel = newStreamChannel<T>(messageChannel.port1);
  try {
    await channel.start();
    void channel.sendAll(input);
    yield* channel.recieveAll();
  } finally {
    await channel.close();
  }
}

export type StreamHandler<T> = (
  input: AsyncIterable<T>,
  params: Record<string, unknown>,
) => AsyncIterable<T> | Promise<AsyncIterable<T>>;

export function handleStreams<T>(
  communicationPort: MessageTarget,
  handler: StreamHandler<T>,
): () => void {
  const listener = async (event: MessageEvent) => {
    const { type, params } = (event.data ?? {}) as {
      type?: string;
      params?: Record<string, unknown>;
    };
    if (type !== "START_CALL") return;
    const port = event.ports[0];
    const channel = newStreamChannel<T>(port);
    try {
      await channel.start();
      const input = channel.recieveAll();
      const response = await handler(input, params ?? {});
      await channel.sendAll(response);
    } finally {
      await channel.close();
    }
  };
  communicationPort.addEventListener("message", listener);
  communicationPort.start?.();
  return () => communicationPort.removeEventListener("message", listener);
}

interface StreamChannel<T> {
  start(): Promise<void>;
  close(): Promise<void>;
  recieveAll(): AsyncGenerator<T, void, unknown>;
  sendAll(it: AsyncIterable<T>): Promise<void>;
}

function newStreamChannel<T>(port: MessageTarget): StreamChannel<T> {
  type DataListener = (msg: { done?: boolean; value?: T; error?: unknown }) => Promise<boolean>;
  let listeners: DataListener[] = [];
  let iterators: AsyncIterable<T>[] = [];

  const notifyAll = async (data: { done?: boolean; value?: T; error?: unknown }) => {
    for (const listener of listeners) await listener(data);
  };

  const channel = newInvokationChannel({
    port,
    handler: (data: unknown) => notifyAll(data as { done?: boolean; value?: T; error?: unknown }),
  });

  const start = () => channel.start();

  const close = async () => {
    await notifyAll({ done: true });
    for (const it of [...iterators]) {
      const iterable = it as AsyncIterable<T> & { return?: () => unknown };
      await iterable.return?.();
    }
    await channel.close();
  };

  async function* recieveAll(): AsyncGenerator<T, void, unknown> {
    yield* recieveIterator<T>((deliver) => {
      listeners.push(deliver as DataListener);
      return () => {
        listeners = listeners.filter((l) => l !== deliver);
      };
    });
  }

  async function sendAll(it: AsyncIterable<T>): Promise<void> {
    await sendIterator<T>(
      (chunk) => void channel.invoke(chunk),
      (async function* () {
        try {
          iterators.push(it);
          yield* it;
        } finally {
          iterators = iterators.filter((i) => i !== it);
        }
      })(),
    );
  }

  return { start, close, recieveAll, sendAll };
}
