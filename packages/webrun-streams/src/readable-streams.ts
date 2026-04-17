export function toReadableStream(it: AsyncIterator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let handled = false;
      try {
        while (true) {
          const slot = await it.next();
          if (!slot || slot.done) break;
          const value = (await slot.value) as Uint8Array;
          controller.enqueue(value);
        }
      } catch (error) {
        handled = true;
        controller.error(error);
      } finally {
        if (!handled) controller.close();
      }
    },
  });
}

export async function* fromReadableStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array, void, unknown> {
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) yield value;
  }
}
