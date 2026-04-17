import type { ListenPortOptions } from "./listen-port.js";
import { recieve } from "./recieve.js";
import { send } from "./send.js";

/**
 * Server half of a full-duplex exchange over a `MessagePort`.
 *
 * For each inbound stream, invokes `handler` with the stream, sends the
 * handler's output back, and yields a counter. The generator never ends
 * on its own — consumers break when they want to stop. Pairs with
 * {@link ioSend}.
 */
export async function* ioHandle<T, U = T>(
  port: MessagePort,
  handler: (input: AsyncIterable<T>) => AsyncIterable<U> | Promise<AsyncIterable<U>>,
  options: ListenPortOptions = {},
): AsyncGenerator<number> {
  let counter = 0;
  for await (const input of recieve<T>(port, options)) {
    const output = await handler(input);
    await send<U>(port, output, options);
    yield counter++;
  }
}
