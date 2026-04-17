import { default as expect } from 'expect.js';
import { ioHandle, ioSend } from '../src/index.js';
import listenBidi from '../src/listenBidi.js';
import callBidi from '../src/callBidi.js';

async function* makeAsync(it, maxTimeout = 20) {
  for await (let value of it) {
    const timeout = Math.random() * maxTimeout;
    await new Promise((resolve) => setTimeout(resolve, timeout));
    yield value;
  }
}

function newMessageChannel() {
  const channel = new MessageChannel();
  channel.port1.start();
  channel.port2.start();
  return channel;
}

describe('listenBidi / callBidi', () => {
  
  it(`should handle input sync streams and return back modified values`, async () => {  
    const channel = newMessageChannel();
    let params;
    const close = listenBidi(channel.port1, async function* read(input, p) {
      params = p;
      for await (let value of input) {
        yield value.toUpperCase();
      }
    });
    try {
      const values = [];
      for await (let value of callBidi(channel.port2, ["Hello", "World"], {
        foo: 'Bar'
      })) {
        values.push(value);
      }
      expect(values).to.eql(["HELLO", "WORLD"])
      expect(params).to.be.a('object');
      const { channelName, ...args } = params;
      expect(!!channelName).to.be(true);
      expect(args).to.eql({ foo : 'Bar' });
    } finally {
      close();
    }
  });
});
