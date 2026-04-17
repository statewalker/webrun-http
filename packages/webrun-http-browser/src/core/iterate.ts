interface Slot<T> {
  error?: unknown;
  value?: T;
  done?: boolean;
  promise: Promise<boolean>;
  notify: (result: boolean) => void;
}

export interface IteratorControl<T> {
  next(value: T): Promise<boolean>;
  complete(): Promise<boolean>;
  error(err: unknown): Promise<boolean>;
}

export type UnsubscribeFn = () => unknown;
export type IteratorInit<T> = (
  control: IteratorControl<T> &
    [IteratorControl<T>["next"], IteratorControl<T>["complete"], IteratorControl<T>["error"]],
) => UnsubscribeFn | undefined | Promise<UnsubscribeFn | undefined>;

interface SlotQueue<T> {
  push(slot: Slot<T>): Promise<void> | void;
  shift(): Promise<Slot<T> | undefined> | Slot<T> | undefined;
}

export async function* iterate<T>(
  init: IteratorInit<T>,
  queue: SlotQueue<T> = [] as unknown as SlotQueue<T>,
): AsyncGenerator<T, void, unknown> {
  let notify: (() => void) | null = null;
  let promise: Promise<void> | undefined;

  type Push = (error: unknown, value: T | undefined, done: boolean) => Promise<boolean>;
  let push: Push = async (error, value, done) => {
    const slot = { error, value, done } as Slot<T>;
    slot.promise = new Promise<boolean>((resolve) => {
      slot.notify = resolve;
    });
    await queue.push(slot);
    notify?.();
    notify = null;
    return slot.promise;
  };

  const next = (value: T) => push(undefined, value, false);
  const complete = () => push(undefined, undefined, true);
  const error = (err: unknown) => push(err, undefined, true);

  const control = Object.assign([next, complete, error], {
    next,
    complete,
    error,
  }) as IteratorControl<T> &
    [IteratorControl<T>["next"], IteratorControl<T>["complete"], IteratorControl<T>["error"]];
  const unsubscribe = await init(control);

  let slot: Slot<T> | undefined;
  try {
    while (true) {
      slot = (await queue.shift()) as Slot<T> | undefined;
      if (slot) {
        try {
          if (slot.error) throw slot.error;
          if (slot.done) break;
          yield slot.value as T;
        } finally {
          slot.notify(true);
        }
      } else {
        if (!notify) {
          promise = new Promise<void>((resolve) => {
            notify = resolve;
          });
        }
        await promise;
      }
    }
  } finally {
    if (notify) (notify as () => void)();
    push = async (_e, _v, _d) => false;
    if (typeof unsubscribe === "function") await unsubscribe();
    while (true) {
      const nextSlot = (await queue.shift()) as Slot<T> | undefined;
      if (!nextSlot) break;
      slot = nextSlot;
      slot.notify(false);
    }
  }
}
