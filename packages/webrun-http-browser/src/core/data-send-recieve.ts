import { newAsyncGenerator } from "./new-async-generator.js";

export type DataMessage<T> = { done?: boolean; value?: T; error?: unknown };
export type DataSender<T> = (msg: DataMessage<T>) => void | Promise<void>;

export function recieveData<T>(
  onMessage: (listener: (msg?: DataMessage<T>) => Promise<boolean>) => (() => unknown) | undefined,
): AsyncGenerator<T> {
  return newAsyncGenerator<T>((next, done) => {
    const unsubscribe = onMessage(async (msg = { done: true }) => {
      const { done: isDone = true, value, error } = msg;
      if (error) return await done(error as Error);
      if (isDone) return await done();
      return await next(value as T);
    });
    if (unsubscribe) {
      return () => {
        unsubscribe();
      };
    }
    return undefined;
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
