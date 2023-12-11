import { serializeError } from './errors.js';

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
