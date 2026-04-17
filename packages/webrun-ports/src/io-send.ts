import type { ListenPortOptions } from "./listen-port.js";
import { recieve } from "./recieve.js";
import { send } from "./send.js";

/**
 * Client half of a full-duplex exchange over a `MessagePort`.
 *
 * Concurrently reads one inbound stream from the peer and writes `output`
 * to it. Yields each value received from the peer. Completes once both
 * directions finish. Pairs with {@link ioHandle}.
 */
export async function* ioSend<T, U = T>(
  port: MessagePort,
  output: AsyncIterable<U> | Iterable<U>,
  options: ListenPortOptions = {},
): AsyncGenerator<T> {
  for await (const input of recieve<T>(port, options)) {
    const promise = send<U>(port, output, options);
    try {
      yield* input;
    } finally {
      await promise;
    }
    break;
  }
}
