export interface SplitServiceUrl {
  url: string;
  key: string;
  baseUrl: string;
  path: string;
  [extra: string]: unknown;
}

/**
 * Splits a URL of the form `<base>/<separator><key>/<path>` into parts.
 * Example: `https://host/~FS/a/b` → `{ baseUrl: "https://host/~FS/", key: "FS", path: "a/b" }`.
 */
export function splitServiceUrl(url: URL | string, separator = "~"): SplitServiceUrl {
  const str = `${url}`;
  const idx = str.indexOf(separator);
  let baseUrl = "";
  let key = "";
  let path = "";
  if (idx >= 0) {
    baseUrl = str.substring(0, idx + separator.length);
    str.substring(idx + separator.length).replace(/^([^/]+)/, (match, $1) => {
      baseUrl += match;
      if (baseUrl.length < str.length) baseUrl += "/";
      key = $1;
      path = str.substring(baseUrl.length);
      return "";
    });
  }
  return { url: str, key, baseUrl, path };
}
