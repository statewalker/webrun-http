import callPort from './callPort.js';
import ioSend from './ioSend.js';

/**
 * This method calls the peer handler over a port
 * with a stream of input values and it returns the stream 
 * of resulting values.
 * 
 * This method internally creates a new channel and send it
 * to the peer with others parameters. The peer starts to
 * read the input stream and send results over this channel.
 *
 * @param {MessagePort} port - The port to call.
 * @param {any} input - The input to send to the peer.
 * @param {object} args - The arguments object containing call parameters.
 * @param {object} args.options - The call options for the port call:
 * @param {number} args.options.bidiTimeout - The timeout of the stream to recieve;
 * by default it is 2147483647 (max integer).
 * @param {number} args.options.timeout - The timeout of invidual calls
 * used to send each individual stream value.
 * @param {object} args.params - Additional call parameters used by peers
 * to handle calls; it could contain some parameters like method name;
 * the peer side will recieve in parameters the generated `channelName` value.
 * @returns {AsyncGenerator} - An async generator that yields the output of the port call.
 */
export default async function* callBidi(port, input, { options = {}, ...params } = {}) {
  const channelName = +(String(Math.random()).substring(2));
  const { bidiTimeout = 2147483647 } = options;
  const promise = callPort(port, { ...params, channelName }, { ...options, timeout: bidiTimeout });
  try {
    yield* ioSend(port, input, {
      ...options,
      channelName,
    });
  } finally {
    await promise;
  }
}
