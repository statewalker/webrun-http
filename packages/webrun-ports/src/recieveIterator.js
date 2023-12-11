import { iterate } from '@statewalker/utils';

export default async function* recieveIterator(onMessage) {
  yield* iterate((observer) => {
    return onMessage(async ({ done = true, value, error } = {}) => {
      if (error) {
        await observer.error(error);
      } else if (done) {
        await observer.complete();
      } else {
        await observer.next(value);
      }
    });
  });
}
