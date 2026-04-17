export interface SerializedError {
  message: string;
  stack?: string;
  [key: string]: unknown;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const out: SerializedError = { message: error.message, stack: error.stack };
    const bag = error as unknown as Record<string, unknown>;
    for (const key of Object.keys(bag)) out[key] = bag[key];
    return out;
  }
  if (typeof error === "object" && error !== null) {
    const bag = error as Record<string, unknown>;
    return { message: String(bag.message ?? error), ...bag };
  }
  return { message: String(error) };
}

export function deserializeError(error: SerializedError | string): Error {
  const payload = typeof error === "string" ? { message: error } : error;
  return Object.assign(new Error(payload.message), payload);
}
