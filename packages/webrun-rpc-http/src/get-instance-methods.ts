/**
 * Collect every callable property of `instance` — including inherited ones —
 * up to (but not including) `Object.prototype`. Constructors and non-function
 * properties are skipped.
 */
export function getInstanceMethods<T>(
  instance: T,
): Record<string, (...args: unknown[]) => unknown> {
  const seen = new Set<string>();
  const methods: Record<string, (...args: unknown[]) => unknown> = {};
  const target = instance as unknown as object;
  for (
    let proto: object | null = target;
    proto && proto !== Object.prototype;
    proto = Reflect.getPrototypeOf(proto)
  ) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (seen.has(key) || key === "constructor") continue;
      seen.add(key);
      const value = Reflect.get(target, key);
      if (typeof value !== "function") continue;
      methods[key] = value as (...args: unknown[]) => unknown;
    }
  }
  return methods;
}
