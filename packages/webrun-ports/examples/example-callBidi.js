import { callBidi, listenBidi } from "../src/index.js";

Promise.resolve().then(main).catch(console.error);
async function main() {
  const channel = new MessageChannel();
  channel.port1.start();
  channel.port2.start();

  // The "server-side" handler transforming input stream 
  // to a sequence of output values:
  async function* handler(input, params) {
    for await (let value of input) {
      yield value.toUpperCase();
    }
  }
  // Registration of the server-side handler:
  const close = listenBidi(channel.port1, handler);
  try {
    // Input values.
    // It could be an AsyncIterator instead.
    const input = ["Hello", "World"]; 
    const params = { foo: 'Bar' };
    for await (let value of callBidi(channel.port2, input, params)) {
      console.log('* ', value);
    }
    // Output:
    // *  HELLO
    // *  WORLD
  } finally {
    close();
  }
}
