import { default as expect } from 'expect.js';
import { newHttpServer, newHttpClient } from '../src/index.js';

describe('newHttpServer/newHttpClient', () => {
  it(`should perform async calls over the port`, async () => {
    const httpHandler = async (request) => {
      const { method, url, headers } = request;
      const headersMap = {}
      for (const [key, value] of headers) {
        headersMap[key] = value;
        console.log(key, value);
      }
      return new Response(JSON.stringify({
        method,
        url,
        headers : headersMap,
        message : "Hello World!"
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    };
    const server = newHttpServer(httpHandler);
    const client = newHttpClient(server);
    const request = new Request("http://localhost:8080?foo=bar", {
      headers : {
        foo: "bar"
      }
    });
    const response = await client(request);
    const json = await response.json();
    expect(json).to.eql({
      method: 'GET',
      url: 'http://localhost:8080/?foo=bar',
      headers: { foo: 'bar' },
      message: 'Hello World!'
    });
  });

});
