import callPort from './callPort.js';
import sendIterator from './sendIterator.js';

/**
 * Sends data from an async iterator to a specified port.
 *
 * @param {MessagePort} port - The port to send the data to.
 * @param {AsyncIterator} output - The data to send.
 * @param {Object} options - Additional options for sending the data.
 * @returns {Promise<void>} - A promise that resolves when the recieved data.
 */
export default async function send(port, output, options = {}) {
  await sendIterator(async ({ done, value, error }) => {
    await callPort(port, { done, value, error }, options);
  }, output);
}
