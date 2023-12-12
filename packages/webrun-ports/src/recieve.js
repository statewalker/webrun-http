import recieveIterator from './recieveIterator.js';
import listenPort from './listenPort.js';

/**
 * This function transforms a sequence of received messages from a specified port
 * into an asynchronous iterator over iterators.
 * Each returned value is an AsyncIterator providing access to individual series of
 * calls.
 *
 * @param {MessagePort} port - The port number to listen to.
 * @param {Object} options - Additional options for receiving messages (optional).
 * @returns {AsyncGenerator<AsyncGenerator>} - An asynchronous generator that yields iterators.
 */
export default async function* recieve(port, options = {}) {
  let onMessage;
  const close = listenPort(
    port,
    async ({ done, value, error }) => {
      await onMessage({ done, value, error });
    },
    options,
  );
  try {
    let interrupted = false;
    while (!interrupted) {
      yield recieveIterator((p) => (onMessage = p));
    }
  } finally {
    close && (await close());
  }
}
