import assert from "node:assert/strict";
import test from "node:test";
import {
  idsNotInSection,
  moveToSection,
  placementFromSections,
  removeFromSection,
} from "./section-placement.ts";

const order = ["a", "b", "c", "d", "e"];

test("a photo is kept in the first section that already has it", () => {
  const placement = placementFromSections(
    [
      ["b", "missing", "a"],
      ["a", "d"],
    ],
    order,
  );
  assert.deepEqual(placement.sections, [
    ["b", "a"],
    ["d"],
  ]);
  assert.deepEqual(placement.unassigned, ["c", "e"]);
});

test("moving photos appends them in folder order and takes them out of other sections", () => {
  const start = placementFromSections(
    [
      ["b"],
      ["d"],
    ],
    order,
  );
  const next = moveToSection(start, order, 0, ["c", "a", "d", "b"]);
  assert.deepEqual(next.sections[0], ["b", "a", "c", "d"]);
  assert.deepEqual(next.sections[1], []);
  assert.deepEqual(next.unassigned, ["e"]);
});

test("moving nothing new leaves the placement as it was", () => {
  const start = placementFromSections([["b"], ["d"]], order);
  assert.equal(moveToSection(start, order, 0, ["b"]), start);
  assert.equal(moveToSection(start, order, 4, ["a"]), start);
});

test("a section can add any included file that is not already in it", () => {
  const placement = placementFromSections([["b"], ["d"]], order);
  assert.deepEqual(idsNotInSection(placement, order, 0), ["a", "c", "d", "e"]);
  assert.deepEqual(idsNotInSection(placement, order, 1), ["a", "b", "c", "e"]);
  assert.deepEqual(idsNotInSection(placement, order, 3), []);
});

test("removing photos returns them to the pool in folder order", () => {
  const start = placementFromSections([["b", "a", "d"], []], order);
  const next = removeFromSection(start, order, 0, ["d", "b"]);
  assert.deepEqual(next.sections[0], ["a"]);
  assert.deepEqual(next.unassigned, ["b", "c", "d", "e"]);
});
