import recieve from './recieve.js';
import send from './send.js';

/**
 * Handles streams of data comming from the port, handle them
 * and send back responses over the same port. This method yields 
 * the counter with the number of requests (iterators) handled.
 * 
 * This method is used as the server part, recieving the
 * request stream and replying to the caller.
 * Works in pair with the `ioSend` method.
 *
 * @param {Port} port - The port to handle.
 * @param {Function} handler - The AsyncGenerator handler function to process the input (an AsyncIterator);
 * generates the output values to send over the port.
 * @param {Object} options - The options for handling the input and output.
 * @returns {AsyncGenerator<number>} - An async generator that yields the counter value.
 */
export default async function* ioHandle(port, handler, options) {
  let counter = 0;
  for await (const input of recieve(port, options)) {
    const output = await handler(input);
    await send(port, output, options);
    yield counter++;
  }
}
