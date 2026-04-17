import { deserializeError } from './errors.js';

/**
 * Implements an asynchronous request/response pattern for communicating with a port.
 * Calls a port with the specified parameters and returns a promise that resolves with the call result.
 * This method is used in conjunction with the `listenPort` function.
 *
 * @param {MessagePort} port - The port to call.
 * @param {Object} params - The parameters to pass to the port.
 * @param {Object} options - The optional configuration options.
 * @param {number} [options.timeout=1000] - The timeout duration in milliseconds.
 * @param {string} [options.channelName=''] - The channel name for filtering messages.
 * @param {Function} [options.log=console.log] - The logging function.
 * @param {Function} [options.newCallId] - The function to generate a new call ID.
 * @returns {Promise} A promise that resolves with the result of the port call.
 */
export default async function callPort(
  port,
  params,
  {
    timeout = 1000,
    channelName = '',
    log = () => {}, // console.log
    newCallId = () => `call-${Date.now()}-${String(Math.random()).substring(2)}`,
  } = {},
) {
  const callId = newCallId();
  log && log('[callPort]', { channelName, callId, params });
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error(`Call timeout. CallId: "${callId}".`)), timeout);
    onMessage = (event) => {
      if (!event.data) return;
      if (event.data.channelName !== channelName) return;
      if (event.data.callId !== callId) return;
      if (event.data.type === 'response:error') {
        reject(deserializeError(event.data.error));
      } else if (event.data.type === 'response:result') {
        resolve(event.data.result);
      }
    };
    port.addEventListener('message', onMessage);
  });
  promise.finally(() => clearTimeout(timerId));
  promise.finally(() => port.removeEventListener('message', onMessage));
  port.postMessage({ type: 'request', channelName, callId, params });
  return promise;
}
