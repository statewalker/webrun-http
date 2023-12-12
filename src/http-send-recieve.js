import { newHttpClientStub, newHttpServerStub } from "./http-stubs.js";

async function* httpToIterator(params) {
  const { options, content } = await params;
  const encoder = new TextEncoder();
  yield encoder.encode(JSON.stringify(options));
  yield* content;
}

async function httpFromIterator(it) {
  it = await it;
  const { done, value } = await it.next();
  let options = {};
  if (!done && value) {
    const decoder = new TextDecoder();
    const str = decoder.decode(value);
    options = JSON.parse(str);
  }
  return {
    options,
    content: it,
  };
}

export function newHttpServer(handler) {
  return async function*(input) {
    const serverStub = newHttpServerStub(handler);
    yield* httpToIterator(serverStub(httpFromIterator(input)));
  }
}

/**
 * 
 * @param {Request} request 
 * @param {async function*(input: AsyncIterable<Uint8Array>): AsyncIterable<Uint8Array>} sendStream 
 * @returns Response
 */
export function newHttpClient(sendStream) {
  return async function(request) {
    const clientStub = newHttpClientStub(async (req) => {
      return await httpFromIterator(
        sendStream(httpToIterator(req)),
      );
    });
    return await clientStub(request);
  }
}
