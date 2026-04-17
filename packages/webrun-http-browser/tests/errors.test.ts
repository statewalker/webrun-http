import { describe, expect, it } from "vitest";
import { deserializeError, serializeError } from "../src/core/errors.js";

describe("serializeError / deserializeError", () => {
  it("serializes a plain Error with message and stack", () => {
    const err = new Error("boom");
    const out = serializeError(err);
    expect(out.message).toBe("boom");
    expect(typeof out.stack).toBe("string");
  });

  it("serializes an Error subclass with extra fields", () => {
    class MyError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    }
    const out = serializeError(new MyError("nope", 403));
    expect(out.message).toBe("nope");
    expect(out.status).toBe(403);
  });

  it("deserializes a string back to an Error", () => {
    const err = deserializeError("oops");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("oops");
  });

  it("roundtrips Error through serialize → deserialize", () => {
    const out = deserializeError(serializeError(new Error("roundtrip")));
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe("roundtrip");
  });

  it("preserves extra fields on roundtrip", () => {
    class TaggedError extends Error {
      code: string;
      constructor(msg: string, code: string) {
        super(msg);
        this.code = code;
      }
    }
    const out = deserializeError(serializeError(new TaggedError("x", "E_X"))) as Error & {
      code?: string;
    };
    expect(out.message).toBe("x");
    expect(out.code).toBe("E_X");
  });
});
