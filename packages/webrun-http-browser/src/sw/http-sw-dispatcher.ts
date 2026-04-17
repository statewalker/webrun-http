import { handleHttpRequests, sendHttpRequest } from "../http/http-send-recieve.js";
import type { HttpHandler } from "../http/http-stubs.js";
import {
  SwPortDispatcher,
  type SwPortDispatcherOptions,
  SwPortHandler,
  type SwPortHandlerOptions,
} from "./sw-dispatcher.js";

export interface SwHttpAdapterOptions extends Omit<SwPortHandlerOptions, "bindPort"> {
  bindPort?: SwPortHandlerOptions["bindPort"];
}

export interface SwHttpRegistration {
  baseUrl: string;
  prefix: string;
  remove(): Promise<void>;
}

export class SwHttpAdapter extends SwPortHandler {
  private readonly _handlers = new Map<string, HttpHandler>();
  private _cleanupRequestChannel?: () => void;

  constructor(options: SwHttpAdapterOptions) {
    super({
      bindPort: () => {},
      ...options,
    });
  }

  protected override async _setCommunicationPort(port: MessagePort): Promise<void> {
    this._cleanupRequestChannel?.();
    this._cleanupRequestChannel = handleHttpRequests(port, this._handleHttpRequest.bind(this));
  }

  private async _handleHttpRequest(request: Request): Promise<Response> {
    const requestUrl = request.url;
    for (const [urlPrefix, handler] of this._handlers) {
      if (requestUrl.indexOf(urlPrefix) === 0) {
        return handler(request);
      }
    }
    return new Response(null, { status: 404, statusText: "Error 404: Not found" });
  }

  /**
   * Registers an HTTP handler on a prefix. Returns the resulting base URL and a
   * disposer.
   */
  async register(prefix: string, handler: HttpHandler): Promise<SwHttpRegistration> {
    const cleanPrefix = `./${(prefix ?? "").replace(/^[./]+/, "")}`;
    const baseUrl = `${new URL(cleanPrefix, this.rootUrl)}`;
    this._handlers.set(baseUrl, handler);
    const handlers = this._handlers;
    return {
      baseUrl,
      prefix: cleanPrefix,
      async remove() {
        handlers.delete(baseUrl);
      },
    };
  }
}

export class SwHttpDispatcher extends SwPortDispatcher {
  start(): void {
    super.start();
    this.self.addEventListener("fetch", this._handleFetchEvent.bind(this));
  }

  private _handleFetchEvent(event: FetchEvent): void {
    event.respondWith(
      (async (): Promise<Response> => {
        const request = event.request;
        try {
          const requestUrl = request.url;
          const rootUrl = this.scope;
          if (requestUrl.indexOf(rootUrl) === 0) {
            const key = requestUrl.substring(rootUrl.length).replace(/^\/?([^/]+).*$/, "$1");
            const channelInfo = await this.loadChannelInfo(key);
            if (channelInfo?.port) {
              return await sendHttpRequest(channelInfo.port, request);
            }
          }
          return await fetch(
            new Request(requestUrl, {
              method: request.method,
              headers: request.headers,
              body: request.body,
              referrer: request.referrer,
              referrerPolicy: request.referrerPolicy,
              credentials: request.credentials,
              cache: request.cache,
              redirect: request.redirect,
              integrity: request.integrity,
            }),
          );
        } catch (error) {
          console.error(error);
          return new Response(null, {
            status: 500,
            statusText: "Error 500: Internal error",
          });
        }
      })(),
    );
  }
}

export function startHttpDispatcher(options: SwPortDispatcherOptions): () => void {
  const dispatcher = new SwHttpDispatcher(options);
  dispatcher.start();
  return () => {
    void dispatcher.stop();
  };
}
