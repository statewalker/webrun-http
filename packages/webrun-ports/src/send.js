import callPort from './callPort.js';
import sendIterator from './sendIterator.js';

export default async function send(port, output, options = {}) {
  await sendIterator(async ({ done, value, error }) => {
    await callPort(port, { done, value, error }, options);
  }, output);
}
