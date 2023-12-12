import { default as expect } from 'expect.js';
import { ioHandle, ioSend } from '../src/index.js';

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

describe('ioHandle / ioSend', () => {
  async function testAsyncCalls(dataToSend, control) {
    const controller = new AbortController();
    try {
      const channel = newMessageChannel();
      const options = {
        channelName: 'test',
      };
      let calls = [];
      (async () => {
        async function* handler(input) {
          for await (const value of input) {
            yield value.toUpperCase();
          }
        }
        for await (let callId of ioHandle(channel.port2, handler, options)) {
          if (controller.signal.aborted) break;
          calls.push(callId);
        }
      })();
      const values = [];
      for await (const value of ioSend(channel.port1, dataToSend, options)) {
        values.push(value);
      }
      expect(values).to.eql(control);
    } finally {
      controller.abort();
    }
  }

  it(`should handle input sync streams and return back modified values`, async () => {
    await testAsyncCalls(['a', 'b', 'c'], ['A', 'B', 'C']);
  });

  it(`should handle input async streams and return back modified values`, async () => {
    await testAsyncCalls(makeAsync(['a', 'b', 'c']), ['A', 'B', 'C']);
  });
});
