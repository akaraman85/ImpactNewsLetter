import assert from "node:assert/strict";
import test from "node:test";
import {
  filterLibrary,
  moveId,
  sectionHeading,
  sectionsForAsset,
  toggleId,
  uniqueKnownIds,
  viewerNeighbors,
} from "./media-picker.ts";

const files = [
  { name: "IMG_1802.mov", kind: "video", included: true },
  { name: "relay.jpg", kind: "image", included: true },
  { name: "notes.JPG", kind: "image", included: false },
];

test("library filters combine kind, inclusion, and search", () => {
  assert.deepEqual(
    filterLibrary(files, "video", "").map((file) => file.name),
    ["IMG_1802.mov"],
  );
  assert.deepEqual(
    filterLibrary(files, "image", "notes").map((file) => file.name),
    ["notes.JPG"],
  );
  assert.deepEqual(
    filterLibrary(files, "excluded", "").map((file) => file.name),
    ["notes.JPG"],
  );
  assert.deepEqual(
    filterLibrary(files, "included", "relay").map((file) => file.name),
    ["relay.jpg"],
  );
  assert.deepEqual(
    filterLibrary(files, "all", "photo").map((file) => file.name),
    ["relay.jpg", "notes.JPG"],
  );
  assert.equal(filterLibrary(files, "all", "video").length, 1);
});

test("section selection keeps known ids in their saved order", () => {
  const known = new Set(["a", "b", "c"]);
  assert.deepEqual(uniqueKnownIds(["b", "missing", "a", "b"], known), ["b", "a"]);
  assert.deepEqual(toggleId(["b", "a"], "c"), ["b", "a", "c"]);
  assert.deepEqual(toggleId(["b", "a"], "b"), ["a"]);
  assert.deepEqual(moveId(["b", "a", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moveId(["b", "a", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveId(["b", "a", "c"], "gone", 1), ["b", "a", "c"]);
});

test("section labels fall back when a heading is blank", () => {
  const sections = [
    { id: "one", heading: "  Races ", assetIds: ["photo"] },
    { id: "two", heading: "   ", assetIds: ["photo"] },
    { id: "three", heading: "Snack", assetIds: ["other"] },
  ];
  assert.equal(sectionHeading(sections[1]!), "Untitled section");
  assert.deepEqual(
    sectionsForAsset(sections, "photo").map((section) => section.id),
    ["one", "two"],
  );
});

test("full-size viewer steps through the pictures that were open", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const first = viewerNeighbors(list, "a");
  assert.equal(first.previous, null);
  assert.equal(first.next?.id, "b");
  assert.equal(first.label, "1 of 3");
  assert.equal(viewerNeighbors(list, "b").previous?.id, "a");
  assert.equal(viewerNeighbors(list, "c").next, null);
  assert.equal(viewerNeighbors(list, "missing").index, -1);
  assert.equal(viewerNeighbors([{ id: "only" }], "only").label, undefined);
});
