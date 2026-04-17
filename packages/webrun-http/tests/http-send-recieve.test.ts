import { describe, expect, it } from "vitest";
import { newHttpClient, newHttpServer } from "../src/http-send-recieve.js";
import { toReadableStream } from "../src/readable-streams.js";

describe("newHttpServer + newHttpClient", () => {
  it("end-to-end GET roundtrip in one process", async () => {
    const handler = async (request: Request) => {
      const headersMap: Record<string, string> = {};
      for (const [k, v] of request.headers) headersMap[k] = v;
      return new Response(
        JSON.stringify({
          method: request.method,
          url: request.url,
          headers: headersMap,
          message: "Hello World!",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    };

    const server = newHttpServer(handler);
    const client = newHttpClient(server);

    const response = await client(
      new Request("http://localhost:8080?foo=bar", {
        headers: { foo: "bar" },
      }),
    );
    const json = (await response.json()) as {
      method: string;
      url: string;
      headers: Record<string, string>;
      message: string;
    };
    expect(json).toEqual({
      method: "GET",
      url: "http://localhost:8080/?foo=bar",
      headers: { foo: "bar" },
      message: "Hello World!",
    });
  });

  it("streams a POST body end-to-end", async () => {
    const handler = async (request: Request) => {
      const text = await request.text();
      return new Response(`echo:${text}`, { headers: { "Content-Type": "text/plain" } });
    };
    const client = newHttpClient(newHttpServer(handler));

    const encoder = new TextEncoder();
    async function* body() {
      yield encoder.encode("hello ");
      yield encoder.encode("world");
    }

    const response = await client(
      new Request("http://localhost/echo", {
        method: "POST",
        body: toReadableStream(body()) as BodyInit,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );
    expect(await response.text()).toBe("echo:hello world");
  });

  it("propagates handler errors as the serialized response status", async () => {
    const handler = async () => new Response("oops", { status: 500, statusText: "Internal Error" });
    const client = newHttpClient(newHttpServer(handler));
    const response = await client(new Request("http://localhost/fail"));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("oops");
  });
});
