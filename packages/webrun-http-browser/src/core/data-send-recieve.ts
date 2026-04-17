import { iterate } from "./iterate.js";

export type DataMessage<T> = { done?: boolean; value?: T; error?: unknown };
export type DataSender<T> = (msg: DataMessage<T>) => void | Promise<void>;

export async function* recieveData<T>(
  onMessage: (listener: (msg?: DataMessage<T>) => Promise<boolean>) => (() => unknown) | undefined,
): AsyncGenerator<T, void, unknown> {
  yield* iterate<T>((iterator) => {
    return onMessage(async (msg = { done: true }) => {
      const { done = true, value, error } = msg;
      if (error) return await iterator.error(error);
      if (done) return await iterator.complete();
      return await iterator.next(value as T);
    });
  });
}

export async function sendData<T>(send: DataSender<T>, it: AsyncIterable<T>): Promise<void> {
  let error: unknown;
  try {
    for await (const value of it) {
      await send({ done: false, value });
    }
  } catch (err) {
    error = err;
  } finally {
    await send({ done: true, error });
  }
}
