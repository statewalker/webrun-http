export interface IteratorChunk<T> {
  done: boolean;
  value?: T;
  error?: unknown;
}

export type ChunkSender<T> = (chunk: IteratorChunk<T>) => void | Promise<void>;

/**
 * Drain an async iterator into a sink that consumes one chunk at a time.
 *
 * Each yielded value becomes `{ done: false, value }`. Completion emits
 * `{ done: true }`. If the iterator throws, the error is caught and the
 * final `done` chunk carries it so the peer can rethrow on its side.
 */
export async function sendIterator<T>(
  send: ChunkSender<T>,
  it: AsyncIterable<T> | Iterable<T>,
): Promise<void> {
  let error: unknown;
  try {
    for await (const value of it as AsyncIterable<T>) {
      await send({ done: false, value });
    }
  } catch (err) {
    error = err;
  } finally {
    await send({ done: true, error });
  }
}
