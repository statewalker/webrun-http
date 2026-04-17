import { type CallPortOptions, callPort } from "./call-port.js";
import { sendIterator } from "./send-iterator.js";

/**
 * Send every value produced by `output` to `port`, one `callPort` round-trip
 * per chunk. Resolves once the peer has acknowledged the final `{ done: true }`
 * envelope. Transport-bound counterpart of {@link sendIterator}; receive side
 * is {@link recieve}.
 */
export async function send<T>(
  port: MessagePort,
  output: AsyncIterable<T> | Iterable<T>,
  options: CallPortOptions = {},
): Promise<void> {
  await sendIterator<T>(async ({ done, value, error }) => {
    await callPort(port, { done, value, error }, options);
  }, output);
}
