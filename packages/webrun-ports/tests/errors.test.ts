import { describe, expect, it } from "vitest";
import { deserializeError, serializeError } from "../src/errors.js";

describe("serializeError / deserializeError", () => {
  it("serialises a plain Error", () => {
    const out = serializeError(new Error("boom"));
    expect(out.message).toBe("boom");
    expect(typeof out.stack).toBe("string");
  });

  it("preserves extra fields on Error subclasses", () => {
    class TaggedError extends Error {
      code: string;
      constructor(msg: string, code: string) {
        super(msg);
        this.code = code;
      }
    }
    const out = serializeError(new TaggedError("nope", "E_NOPE"));
    expect(out.message).toBe("nope");
    expect(out.code).toBe("E_NOPE");
  });

  it("handles non-Error throwables", () => {
    expect(serializeError("string-throw")).toMatchObject({ message: "string-throw" });
    expect(serializeError({ message: "obj", extra: 1 })).toMatchObject({
      message: "obj",
      extra: 1,
    });
    expect(serializeError(42)).toMatchObject({ message: "42" });
  });

  it("deserialises a string into an Error", () => {
    const err = deserializeError("oops");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("oops");
  });

  it("roundtrips message and extra fields", () => {
    const err = new Error("roundtrip") as Error & { status?: number };
    err.status = 418;
    const out = deserializeError(serializeError(err)) as Error & { status?: number };
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe("roundtrip");
    expect(out.status).toBe(418);
  });
});
