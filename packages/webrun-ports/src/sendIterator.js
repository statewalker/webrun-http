/**
 * Sends values from an iterator to a specified function.
 * 
 * @param {Function} send - The function sending values to the remote handlers.
 * @param {AsyncIterator} it - The iterator to send values from.
 * @returns {Promise<void>} - A promise that resolves when the iterator is fully consumed.
 */
export default async function sendIterator(send, it) {
  let error;
  try {
    for await (let value of it) {
      await send({ done: false, value });
    }
  } catch (err) {
    error = err;
  } finally {
    await send({ done: true, error });
  }
}
