import { type ListenPortOptions, listenPort } from "./listen-port.js";
import { recieveIterator } from "./recieve-iterator.js";
import type { IteratorChunk } from "./send-iterator.js";

/**
 * Async generator over async generators. Each outer yield is one inbound
 * stream reconstructed from chunk-envelopes delivered by the peer's
 * {@link send}.
 *
 * The outer generator itself never ends: break out of the outer loop when
 * you've handled the streams you care about.
 */
export async function* recieve<T>(
  port: MessagePort,
  options: ListenPortOptions = {},
): AsyncGenerator<AsyncGenerator<T>> {
  let onMessage: ((chunk: IteratorChunk<T>) => Promise<boolean>) | undefined;
  const close = listenPort<IteratorChunk<T>, void>(
    port,
    async ({ done, value, error }) => {
      await onMessage?.({ done, value, error });
    },
    options,
  );
  try {
    while (true) {
      yield recieveIterator<T>((deliver) => {
        onMessage = deliver;
      });
    }
  } finally {
    close();
  }
}
