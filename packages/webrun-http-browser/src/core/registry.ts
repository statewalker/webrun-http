export type CleanupAction = () => unknown;

interface CleanupFn {
  (skip?: boolean): unknown;
  action: CleanupAction;
}

export interface Registry {
  register(action: CleanupAction): CleanupFn;
  unregister(action: CleanupAction): void;
  clear(): void;
}

export type NewRegistryResult = [
  register: Registry["register"],
  clear: Registry["clear"],
  unregister: Registry["unregister"],
] &
  Registry;

export function newRegistry(onError: (error: unknown) => void = console.error): NewRegistryResult {
  let counter = 0;
  const registrations: Record<number, CleanupFn> = {};

  const register: Registry["register"] = (action) => {
    const id = counter++;
    const fn: CleanupFn = Object.assign(
      (skip?: boolean) => {
        try {
          delete registrations[id];
          return skip ? undefined : action();
        } catch (error) {
          onError(error);
        }
      },
      { action },
    );
    registrations[id] = fn;
    return fn;
  };

  const unregister: Registry["unregister"] = (action) => {
    for (const r of Object.values(registrations)) {
      if (r.action === action) r(true);
    }
  };

  const clear: Registry["clear"] = () => {
    for (const r of Object.values(registrations)) r();
  };

  const tuple = [register, clear, unregister] as NewRegistryResult;
  return Object.assign(tuple, { register, clear, unregister });
}
