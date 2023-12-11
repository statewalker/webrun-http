import { default as expect } from 'expect.js';
import {
  callPort,
  listenPort,
  recieve,
  recieveIterator,
  send,
  sendIterator,
} from '../src/index.js';

async function* makeAsync(it, maxTimeout = 20) {
  for await (let value of it) {
    const timeout = Math.random() * maxTimeout;
    await new Promise((resolve) => setTimeout(resolve, timeout));
    yield value;
  }
}

describe('sendIterator', () => {
  async function testAsyncCalls(dataToSend, control) {
    const channel = new MessageChannel();
    let calls = 0;
    let values = [];
    const close = listenPort(channel.port1, async ({ done, value }) => {
      if (!done) values.push(value);
      await new Promise((resolve) => setTimeout(resolve, 10));
      calls++;
    });
    try {
      const send = async (params) => {
        return await callPort(channel.port2, params);
      };
      await sendIterator(send, dataToSend);
      expect(calls).to.be(control.length + 1);
      expect(values).to.eql(control);
    } finally {
      close();
    }
  }
  it(`should send/recieve sync messages over a MessageChannel port`, async () => {
    await testAsyncCalls([1, 2, 3], [1, 2, 3]);
  });
  it(`should send/recieve async messages over a MessageChannel port`, async () => {
    await testAsyncCalls(makeAsync([1, 2, 3]), [1, 2, 3]);
  });
});

describe('recieveIterator', () => {
  async function testAsyncCalls(dataToSend, control) {
    const channel = new MessageChannel();
    let recieveMessage;
    const it = await recieveIterator((p) => (recieveMessage = p));
    const close = listenPort(channel.port1, async ({ done, value, error }) => {
      // await new Promise((resolve) => setTimeout(resolve, 10));
      await recieveMessage({ done, value, error });
    });
    try {
      (async () => {
        const sendMessage = async ({ done, value, error }) => {
          return await callPort(channel.port2, { done, value, error });
        };
        await sendIterator(sendMessage, dataToSend);
      })();

      let values = [];
      for await (let value of it) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        values.push(value);
      }
      expect(values).to.eql(control);
    } finally {
      close();
    }
  }

  it(`should send/recieve sync messages over a MessageChannel port`, async () => {
    await testAsyncCalls([1, 2, 3], [1, 2, 3]);
  });
  it(`should send/recieve async messages over a MessageChannel port`, async () => {
    await testAsyncCalls(makeAsync([1, 2, 3]), [1, 2, 3]);
  });
});

describe('send/recieve over a message port', () => {
  async function testAsyncCalls(dataToSend, control, channelName = '') {
    const channel = new MessageChannel();
    const input = recieve(channel.port1, { channelName });
    (async () => {
      await send(channel.port2, dataToSend, { channelName });
    })();

    let values = [];
    for await (let value of input) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      values.push(value);
    }
    expect(values).to.eql(control);
  }

  it(`should send/recieve sync messages over a MessageChannel port`, async () => {
    await testAsyncCalls([1, 2, 3], [1, 2, 3], '');
    await testAsyncCalls([1, 2, 3], [1, 2, 3], 'a');
    await testAsyncCalls([1, 2, 3], [1, 2, 3], 'a:b:c');
  });
  it(`should send/recieve async messages over a MessageChannel port`, async () => {
    await testAsyncCalls(makeAsync([1, 2, 3]), [1, 2, 3], '');
    await testAsyncCalls(makeAsync([1, 2, 3]), [1, 2, 3], 'a:');
    await testAsyncCalls(makeAsync([1, 2, 3]), [1, 2, 3], 'a:b:c:');
  });
});
