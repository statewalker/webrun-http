import { iterate } from '@statewalker/utils';

/**
 * Asynchronous generator function that receives messages and yields message values to the caller.
 * 
 * @param {Function} onMessage - The callback function to handle incoming messages.
 * @returns {AsyncGenerator} An asynchronous generator that yields received values.
 */
export default async function* recieveIterator(onMessage) {
  let observer, cleanup = onMessage(async ({ done = true, value, error } = {}) => {
    if (error) {
      await observer.error(error);
    } else if (done) {
      await observer.complete();
    } else {
      await observer.next(value);
    }
  });
  yield* iterate((o) => {
    observer = o;
    return cleanup;
  });
}
