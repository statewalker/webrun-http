import { type CallPortOptions, callPort } from "./call-port.js";
import { ioSend } from "./io-send.js";

export interface CallBidiOptions extends CallPortOptions {
  /** Timeout for the outer stream (default: `Number.MAX_SAFE_INTEGER` / max int). */
  bidiTimeout?: number;
}

export interface CallBidiArgs {
  options?: CallBidiOptions;
  [key: string]: unknown;
}

/**
 * Initiates a full-duplex stream call: ships `input` values to the peer and
 * yields the values returned by `listenBidi`'s handler.
 *
 * Internally allocates a fresh sub-channel name, announces it to the peer
 * via `callPort`, and then runs {@link ioSend} on that sub-channel.
 */
export async function* callBidi<TIn, TOut>(
  port: MessagePort,
  input: AsyncIterable<TIn> | Iterable<TIn>,
  { options = {}, ...params }: CallBidiArgs = {},
): AsyncGenerator<TOut> {
  const channelName = `${+String(Math.random()).substring(2)}`;
  const { bidiTimeout = 2147483647 } = options;
  const promise = callPort(port, { ...params, channelName }, { ...options, timeout: bidiTimeout });
  try {
    yield* ioSend<TOut, TIn>(port, input, {
      ...options,
      channelName,
    });
  } finally {
    await promise;
  }
}
