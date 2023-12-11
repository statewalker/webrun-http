export default async function sendIterator(send, it) {
  let error;
  try {
    for await (let value of it) {
      await send({ done: false, value });
    }
  } catch (err) {
    error = err;
  } finally {
    await send({ done: true, error });
  }
}
