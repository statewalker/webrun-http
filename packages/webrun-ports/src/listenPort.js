import { serializeError } from './errors.js';

/**
 * Listens to a specific port and handles incoming messages.
 * The result of the handler function is sent back to the port.
 * This function is used to implement the request/response pattern 
 * in conjunction with the `callPort` function.
 * 
 * Ths method returns a function to remove the event listener.
 *
 * @param {MessagePort} port - The port to listen to.
 * @param {Function} handler - The function to handle incoming messages.
 * @param {Object} options - Additional options.
 * @param {string} [options.channelName=''] - The channel name to filter incoming messages.
 * @param {Function} [options.log=console.log] - The logging function.
 * @returns {Function} - A function to remove the event listener.
 */
export default function listenPort(
  port,
  handler,
  {
    channelName = '',
    log = () => {}, // console.log
  } = {},
) {
  const onMessage = async function callback(event) {
    if (!event.data || event.data.channelName !== channelName || event.data.type !== 'request')
      return;
    const { callId, params } = event.data;
    log && log('[listenPort]', { channelName, callId, params });
    let result, error, type;
    try {
      result = await handler(params);
      type = 'response:result';
    } catch (e) {
      error = serializeError(e);
      type = 'response:error';
    }
    port.postMessage({ callId, channelName, type, result, error });
  };
  port.addEventListener('message', onMessage);
  return () => port.removeEventListener('message', onMessage);
}
