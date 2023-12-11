import recieveIterator from './recieveIterator.js';
import listenPort from './listenPort.js';

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
