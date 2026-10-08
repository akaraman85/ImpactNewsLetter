import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { fetchPreviewJpeg, resetPreviewState } from "./preview-bytes.ts";

const originalFetch = globalThis.fetch;
const photoUrl = "https://www.dropbox.com/scl/fi/abc/photo.jpg?raw=1";

function dropboxResponse(body: BodyInit, init: ResponseInit = {}) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", {
    value: "https://dl.dropboxusercontent.com/s/abc/photo.jpg",
  });
  return response;
}

async function jpegBytes() {
  return sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 20, g: 80, b: 140 } },
  })
    .jpeg()
    .toBuffer();
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetPreviewState();
});

test("a throttled dropbox download is tried again", async () => {
  const jpeg = await jpegBytes();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return dropboxResponse("slow", { status: 429 });
    return dropboxResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  }) as typeof fetch;
  const preview = await fetchPreviewJpeg(photoUrl, "thumb");
  assert.equal(calls, 2);
  assert.ok(preview);
  assert.equal(preview[0], 0xff);
  assert.equal(preview[1], 0xd8);
});

test("the same photo is downloaded once while two previews ask together", async () => {
  const jpeg = await jpegBytes();
  let calls = 0;
  let release: (response: Response) => void = () => {};
  const gate = new Promise<Response>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = (() => {
    calls += 1;
    return gate;
  }) as typeof fetch;
  const first = fetchPreviewJpeg(`${photoUrl}&id=shared`, "thumb");
  const second = fetchPreviewJpeg(`${photoUrl}&id=shared`, "thumb");
  release(
    dropboxResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    }),
  );
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.ok(a && b && a.equals(b));
});

test("a folder zip is refused before it is read", async () => {
  globalThis.fetch = (async () => {
    const response = dropboxResponse("PK", {
      status: 200,
      headers: { "content-type": "application/zip", "content-length": "810349046" },
    });
    response.arrayBuffer = async () => {
      throw new Error("body was read");
    };
    return response;
  }) as typeof fetch;
  const preview = await fetchPreviewJpeg(`${photoUrl}&id=zip`, "thumb");
  assert.equal(preview, null);
});
