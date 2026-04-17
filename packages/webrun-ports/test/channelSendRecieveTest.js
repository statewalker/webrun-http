import { default as expect } from 'expect.js';
import { callPort, listenPort } from '../src/index.js';

function newMessageChannel() {
  const channel = new MessageChannel();
  channel.port1.start();
  channel.port2.start();
  return channel;
}

describe('callPort/listenPort', () => {
  it(`should perform async calls over the port`, async () => {
    const channel = newMessageChannel();
    const close = listenPort(channel.port1, async (params) => {
      return params;
    });
    const result = await callPort(channel.port2, { foo: 'bar' });
    expect(result).to.eql({ foo: 'bar' });
    close();
  });

  it(`should rise an exception if the call takes too much time`, async () => {
    const channel = newMessageChannel();
    const close = listenPort(channel.port1, async (params) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return params;
    });
    let exception;
    try {
      await callPort(channel.port2, { foo: 'bar' }, { timeout: 300 });
    } catch (e) {
      exception = e;
    }
    expect(typeof exception).to.be('object');
    expect(exception.message.indexOf('Call timeout') >= 0).to.be(true);
    close();
  });
});
