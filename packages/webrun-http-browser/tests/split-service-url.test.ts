import { describe, expect, it } from "vitest";
import { splitServiceUrl } from "../src/relay/split-service-url.js";

describe("splitServiceUrl", () => {
  it("splits a full URL with path", () => {
    expect(splitServiceUrl("https://host.com/~FS/some/path.txt")).toEqual({
      url: "https://host.com/~FS/some/path.txt",
      key: "FS",
      baseUrl: "https://host.com/~FS/",
      path: "some/path.txt",
    });
  });

  it("splits URL with key only, no trailing slash", () => {
    expect(splitServiceUrl("https://host.com/~FS")).toEqual({
      url: "https://host.com/~FS",
      key: "FS",
      baseUrl: "https://host.com/~FS",
      path: "",
    });
  });

  it("returns empty key/baseUrl/path when no separator present", () => {
    const res = splitServiceUrl("https://host.com/no/service");
    expect(res).toEqual({
      url: "https://host.com/no/service",
      key: "",
      baseUrl: "",
      path: "",
    });
  });

  it("accepts a URL object", () => {
    const res = splitServiceUrl(new URL("https://a.b/~K/x"));
    expect(res.key).toBe("K");
    expect(res.path).toBe("x");
  });

  it("honours a custom separator", () => {
    const res = splitServiceUrl("https://a.b/@SVC/q/r", "@");
    expect(res).toEqual({
      url: "https://a.b/@SVC/q/r",
      key: "SVC",
      baseUrl: "https://a.b/@SVC/",
      path: "q/r",
    });
  });
});
