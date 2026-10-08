import assert from "node:assert/strict";
import test from "node:test";
import { createSlotQueue } from "./preview-queue.ts";

test("a preview queue holds later photos until an earlier one finishes", async () => {
  const queue = createSlotQueue(2);
  const first = await queue.acquire();
  const second = await queue.acquire();
  let thirdStarted = false;
  const third = queue.acquire().then((release) => {
    thirdStarted = true;
    return release;
  });
  await Promise.resolve();
  assert.equal(thirdStarted, false);
  first();
  const releaseThird = await third;
  assert.equal(thirdStarted, true);
  second();
  releaseThird();
  releaseThird();
  const fourth = await queue.acquire();
  fourth();
});
