// One shared folder can put dozens of photo requests in flight together.
// Dropbox answers part of that burst with an error, which showed up as a 404.
export function createSlotQueue(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  function start(resolve: (release: () => void) => void) {
    active += 1;
    let released = false;
    resolve(() => {
      if (released) return;
      released = true;
      active -= 1;
      const next = waiting.shift();
      if (next) next();
    });
  }

  return {
    acquire() {
      return new Promise<() => void>((resolve) => {
        if (active < limit) {
          start(resolve);
          return;
        }
        waiting.push(() => start(resolve));
      });
    },
  };
}
