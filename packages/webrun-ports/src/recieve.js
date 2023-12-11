import recieveIterator from './recieveIterator.js';
import listenPort from './listenPort.js';

/**
 * This function transforms a sequence of received messages from a specified port into an asynchronous iterator.
 * 
 * @param {MessagePort} port - The port number to listen to.
 * @param {Object} options - Additional options for receiving messages (optional).
 * @returns {AsyncGenerator} - An asynchronous generator that yields received messages.
 */
export default async function* recieve(port, options = {}) {
  let onMessage;
  const input = await recieveIterator((p) => (onMessage = p));
  const close = listenPort(
    port,
    async ({ done, value, error }) => {
      await onMessage({ done, value, error });
    },
    options,
  );
  try {
    yield* input;
  } finally {
    close && (await close());
  }
}
