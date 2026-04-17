import recieve from './recieve.js';
import send from './send.js';

/**
 * Sends the given output values to the port and yield asynchronously
 * the response from the other side.
 * This method is used as the client part, sending requests to the server.
 * Works in pair with the `ioHandle` method.
 *
 * @param {Port} port - The input port to receive data from.
 * @param {AsyncGenerator} output - The output values to send to the port.
 * @param {Object} options - Additional options for sending data.
 * @return {AsyncGenerator} - an async generator returning the recieved values.
 */
export default async function* ioSend(port, output, options) {
  for await (const input of recieve(port, options)) {
    const promise = send(port, output, options);
    try {
      yield* input;
    } finally {
      await promise;
    }
    break;
  }
}
