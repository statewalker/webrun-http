/** Any value that can survive a JSON round-trip. */
export type Json = string | number | boolean | null | Json[] | JsonObject;

/** A JSON object — the only valid shape for RPC call params. */
export interface JsonObject {
  [key: string]: Json;
}

/**
 * An RPC method. Takes a JSON-shaped `params` argument and an optional binary
 * `body`, returns a JSON value or a `Blob`.
 */
export type RpcMethod = (params: Json, body?: Blob) => Promise<Blob | Json>;
