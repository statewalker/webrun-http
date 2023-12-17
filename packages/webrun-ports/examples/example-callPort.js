import { callPort, listenPort } from "../src/index.js";

Promise.resolve().then(main).catch(console.error);
async function main() {
  const channel = new MessageChannel();
  channel.port1.start();
  channel.port2.start();
  const close = listenPort(channel.port1, async (params) => {
    return {
      message: "Hello World!",
      params
    }
  });
  try {
    const result = await callPort(channel.port2, { foo: "bar" });
    console.log(result);
    // Output:
    // { message: 'Hello World!', params: { foo: 'bar' } }
  } finally {
    close();
  }
}
