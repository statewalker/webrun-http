import { handleStreams, sendStream } from "../core/data-channels.js";
import type { MessageTarget } from "../core/message-target.js";
import {
  type HttpHandler,
  newHttpClientStub,
  newHttpServerStub,
  type SerializedHttpEnvelope,
  type SerializedHttpRequest,
  type SerializedHttpResponse,
} from "./http-stubs.js";

type AnyEnvelope = SerializedHttpEnvelope<SerializedHttpRequest | SerializedHttpResponse>;

async function* httpToIterator(
  envelopeOrPromise: AnyEnvelope | Promise<AnyEnvelope>,
): AsyncGenerator<Uint8Array, void, unknown> {
  const { options, content } = await envelopeOrPromise;
  const encoder = new TextEncoder();
  yield encoder.encode(JSON.stringify(options));
  yield* content;
}

async function httpFromIterator<Options>(
  iterable: AsyncIterable<Uint8Array> | Promise<AsyncIterable<Uint8Array>>,
): Promise<SerializedHttpEnvelope<Options>> {
  const it = (await iterable)[Symbol.asyncIterator]();
  const { done, value } = await it.next();
  let options = {} as Options;
  if (!done && value) {
    const str = new TextDecoder().decode(value);
    options = JSON.parse(str) as Options;
  }
  const content: AsyncIterable<Uint8Array> = {
    [Symbol.asyncIterator]() {
      return it;
    },
  };
  return { options, content };
}

export function handleHttpRequests(
  communicationPort: MessageTarget,
  handler: HttpHandler,
): () => void {
  const serverStub = newHttpServerStub(handler);
  return handleStreams<Uint8Array>(communicationPort, async (it) => {
    const envelope = await httpFromIterator<SerializedHttpRequest>(it);
    const response = await serverStub(envelope);
    return httpToIterator(response);
  });
}

export async function sendHttpRequest(
  communicationPort: MessageTarget,
  request: Request,
): Promise<Response> {
  const clientStub = newHttpClientStub(async (req) => {
    return await httpFromIterator<SerializedHttpResponse>(
      sendStream<Uint8Array>(communicationPort, httpToIterator(req)),
    );
  });
  return await clientStub(request);
}
