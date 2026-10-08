import assert from "node:assert/strict";
import test from "node:test";
import { emptyContent, parseContent, placeUnusedAssets } from "./content.ts";
import {
  canonicalSharedLink,
  dropboxRawUrl,
  isFolderLink,
  listAllSharedEntries,
  mediaFromSharedFolderHtml,
  mediaKind,
  sharedFolderRequest,
} from "./dropbox.ts";
import { requestOrigin } from "./format.ts";
import { planStoryLayouts, storyIsWide } from "./newsletter-layout.ts";

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
  assert.equal(storyIsWide({ id: "section-1", imageCount: 2, videoCount: 0 }), false);
  assert.equal(storyIsWide({ id: "section-1", imageCount: 3, videoCount: 0 }), true);
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

test("shared links keep rlkey and drop the website tracking parameters", () => {
  const canonical = canonicalSharedLink(
    "https://www.dropbox.com/scl/fo/abc/folder?rlkey=stem&st=knarchgi&dl=0",
  );
  const url = new URL(canonical);
  assert.equal(url.searchParams.get("rlkey"), "stem");
  assert.equal(url.searchParams.get("st"), null);
  assert.equal(url.searchParams.get("dl"), null);
});

test("a public folder page lists its photos and videos", () => {
  const fileUrl =
    "https://www.dropbox.com/scl/fo/abc/AAMd0m3E0eg_Ya77lHZdwEk/IMG_1802.mov?rlkey=stem&dl=0";
  const html = `<script>registerStreamedPrefetch("abc", "${Buffer.from(
    `folder ${fileUrl} notes.pdf \\page_size\\": 75, \\"page_offset\\": 1`,
  ).toString("base64")}")</script>`;
  const listed = mediaFromSharedFolderHtml(html);
  assert.equal(listed.truncated, false);
  assert.equal(listed.files.length, 1);
  assert.equal(listed.files[0]?.name, "IMG_1802.mov");
  assert.equal(listed.files[0]?.kind, "video");
  assert.equal(listed.files[0]?.sourceUrl, "https://www.dropbox.com/scl/fo/abc/AAMd0m3E0eg_Ya77lHZdwEk/IMG_1802.mov?rlkey=stem");
});

test("a public page with a continuation voucher still has more files", () => {
  const fileUrl = "https://www.dropbox.com/scl/fo/abc/token/photo.jpg?rlkey=stem&dl=0";
  const voucher = JSON.stringify({
    prog: JSON.stringify({ ctx: { page_size: 75, page_offset: 16 } }),
    sig: "abc",
  });
  const html = `<script>registerStreamedPrefetch("abc", "${Buffer.from(
    `${fileUrl} ${voucher}`,
  ).toString("base64")}")</script>`;
  const listed = mediaFromSharedFolderHtml(html);
  assert.equal(listed.truncated, true);
  assert.equal(listed.files[0]?.name, "photo.jpg");
});

test("shared folder links keep the listing key", () => {
  const request = sharedFolderRequest(
    "https://www.dropbox.com/scl/fo/abc/hash/Day?rlkey=stem&st=knarchgi&dl=0",
  );
  assert.deepEqual(request, {
    linkKey: "abc",
    linkType: "c",
    secureHash: "hash",
    subPath: "Day",
    rlkey: "stem",
  });
  assert.equal(sharedFolderRequest("https://www.dropbox.com/scl/fi/abc/photo.jpg?rlkey=stem"), null);
});

test("later shared-folder pages are imported with the first screen", async () => {
  const files = await listAllSharedEntries(async (subPath, voucher) => {
    if (subPath === "/Day") {
      return {
        entries: [
          {
            filename: "inside.jpeg",
            href: "https://www.dropbox.com/scl/fo/abc/token/Day/inside.jpeg?rlkey=stem&dl=0",
            is_dir: false,
          },
        ],
        has_more_entries: false,
      };
    }
    if (!voucher) {
      return {
        entries: [
          {
            filename: "IMG_1802.mov",
            href: "https://www.dropbox.com/scl/fo/abc/token/IMG_1802.mov?rlkey=stem&dl=0",
            is_dir: false,
          },
        ],
        has_more_entries: true,
        next_request_voucher: "page-2",
      };
    }
    assert.equal(voucher, "page-2");
    return {
      entries: [
        {
          filename: "Photo Oct 04 2026, 1 01 05 PM.jpg",
          href: "https://www.dropbox.com/scl/fo/abc/token/Photo%20Oct%2004%202026%2C%201%2001%2005%20PM.jpg?rlkey=stem&dl=0",
          is_dir: false,
        },
        { filename: "Day", href: "https://www.dropbox.com/scl/fo/abc/hash/Day?rlkey=stem", is_dir: true },
        {
          filename: "notes.pdf",
          href: "https://www.dropbox.com/scl/fo/abc/token/notes.pdf?rlkey=stem&dl=0",
          is_dir: false,
        },
      ],
      has_more_entries: false,
    };
  });
  assert.deepEqual(
    files.map((file) => file.name),
    ["IMG_1802.mov", "inside.jpeg", "Photo Oct 04 2026, 1 01 05 PM.jpg"],
  );
  assert.equal(
    files.find((file) => file.name.startsWith("Photo"))?.sourceUrl,
    "https://www.dropbox.com/scl/fo/abc/token/Photo%20Oct%2004%202026%2C%201%2001%2005%20PM.jpg?rlkey=stem",
  );
});

test("a full public page is marked truncated", () => {
  const fileUrl = "https://www.dropbox.com/scl/fo/abc/token/photo.jpg?rlkey=stem&dl=0";
  const html = Buffer.from(`\\"page_size\\": 1, \\"page_offset\\": 1 ${fileUrl}`).toString("utf8");
  const wrapped = `<script>registerStreamedPrefetch("abc", "${Buffer.from(html).toString("base64")}")</script>`;
  const listed = mediaFromSharedFolderHtml(wrapped);
  assert.equal(listed.truncated, true);
  assert.equal(listed.files[0]?.name, "photo.jpg");
});
