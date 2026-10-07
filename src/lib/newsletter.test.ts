import assert from "node:assert/strict";
import test from "node:test";
import { emptyContent, parseContent, placeUnusedAssets } from "./content.ts";
import { planStoryLayouts, storyIsWide } from "./newsletter-layout.ts";
import { dropboxRawUrl, isFolderLink, mediaKind } from "./dropbox.ts";
import { requestOrigin } from "./format.ts";

test("parseContent keeps known sections and ignores junk", () => {
  const content = parseContent(
    {
      headline: "Field day",
      sections: [{ id: "a", heading: "Races", body: "Fast.", assetIds: ["1", 2] }, null],
    },
    "Fallback",
  );
  assert.equal(content.headline, "Field day");
  assert.equal(content.sections.length, 1);
  assert.deepEqual(content.sections[0]?.assetIds, ["1"]);
});

test("empty content uses the fallback headline", () => {
  assert.equal(parseContent(null, "Picnic").headline, "Picnic");
  assert.deepEqual(emptyContent("Picnic").sections, []);
});

test("unused photos join an existing more-from-the-day section", () => {
  const placed = placeUnusedAssets(
    {
      headline: "Day",
      subtitle: "",
      intro: "",
      closing: "",
      sections: [{ id: "more-from-the-day", heading: "More from the day", body: "", assetIds: ["photo-1"] }],
    },
    ["photo-1", "photo-2"],
  );
  assert.equal(placed.sections.length, 1);
  assert.deepEqual(placed.sections[0]?.assetIds, ["photo-1", "photo-2"]);
});

test("unused photos are gathered into a last section", () => {
  const placed = placeUnusedAssets(
    {
      headline: "Day",
      subtitle: "",
      intro: "",
      closing: "",
      sections: [{ id: "a", heading: "One", body: "", assetIds: ["photo-1"] }],
    },
    ["photo-1", "photo-2"],
  );
  assert.deepEqual(placed.sections.at(-1)?.assetIds, ["photo-2"]);
});

test("dropbox links become raw file urls", () => {
  const raw = dropboxRawUrl("https://www.dropbox.com/scl/fi/abc/relay.jpg?dl=0&rlkey=xyz");
  assert.ok(raw);
  const url = new URL(raw);
  assert.equal(url.searchParams.get("raw"), "1");
  assert.equal(url.searchParams.get("dl"), null);
});

test("local staff links stay on http and deployed links stay on https", () => {
  assert.equal(requestOrigin(new Headers({ host: "127.0.0.1:3000" })), "http://127.0.0.1:3000");
  assert.equal(
    requestOrigin(
      new Headers({
        host: "impact-newsletter.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    "https://impact-newsletter.vercel.app",
  );
});

test("short stories sit in pairs and a leftover spans the row", () => {
  assert.deepEqual(planStoryLayouts([false, false, false]), ["card", "card", "feature"]);
  assert.deepEqual(planStoryLayouts([false, false, false, false]), ["card", "card", "card", "card"]);
  assert.deepEqual(planStoryLayouts([true, false, false]), ["feature", "card", "card"]);
  assert.deepEqual(planStoryLayouts([false, true, false]), ["feature", "feature", "feature"]);
  assert.deepEqual(planStoryLayouts([false]), ["feature"]);
});

test("photo dumps and video groups take the full width", () => {
  assert.equal(storyIsWide({ id: "section-1", imageCount: 4, videoCount: 0 }), false);
  assert.equal(storyIsWide({ id: "section-1", imageCount: 5, videoCount: 0 }), true);
  assert.equal(storyIsWide({ id: "section-1", imageCount: 0, videoCount: 2 }), true);
  assert.equal(storyIsWide({ id: "more-from-the-day", imageCount: 1, videoCount: 0 }), true);
});

test("folder links and file kinds are recognized", () => {
  assert.equal(isFolderLink("https://www.dropbox.com/scl/fo/abc/folder?rlkey=1"), true);
  assert.equal(isFolderLink("https://www.dropbox.com/scl/fi/abc/relay.jpg"), false);
  assert.equal(mediaKind("relay.JPG"), "image");
  assert.equal(mediaKind("game.mp4"), "video");
  assert.equal(mediaKind("notes.pdf"), null);
});
