import { deserializeError } from './errors.js';

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
    timerId = setTimeout(() => reject(new Error('Call timeout')), timeout);
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
