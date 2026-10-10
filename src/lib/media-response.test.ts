import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { BROWSER_UA } from "./dropbox.ts";
import { fetchPreviewJpeg, resetPreviewState } from "./preview-bytes.ts";
import { streamVideo } from "./video-stream.ts";

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

const clipUrl = "https://www.dropbox.com/scl/fi/abc/IMG_1802.mov?rlkey=stem&raw=1";
const clipBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);

function videoUpstream(body: BodyInit | null, init: ResponseInit = {}, finalUrl = "https://dl.dropboxusercontent.com/s/abc/IMG_1802.mov") {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: finalUrl });
  return response;
}

test("a video plays from this site with the range the player asked for", async () => {
  let requested: { url: string; range: string | null; userAgent: string | null } | null = null;
  globalThis.fetch = (async (input, init) => {
    const headers = new Headers(init?.headers);
    requested = {
      url: String(input),
      range: headers.get("range"),
      userAgent: headers.get("user-agent"),
    };
    return videoUpstream(clipBytes, {
      status: 206,
      headers: {
        "content-type": "application/octet-stream",
        "content-range": "bytes 0-7/8",
        "content-length": "8",
        "accept-ranges": "bytes",
      },
    });
  }) as typeof fetch;

  const response = await streamVideo(
    new Request("https://newsletter.test/api/media/token/clip", { headers: { Range: "bytes=0-7" } }),
    clipUrl,
    "IMG_1802.mov",
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("content-range"), "bytes 0-7/8");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-disposition"), "inline");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), clipBytes);
  assert.ok(requested);
  assert.equal(new URL(requested.url).searchParams.get("dl"), "1");
  assert.equal(new URL(requested.url).searchParams.get("raw"), null);
  assert.equal(requested.range, "bytes=0-7");
  assert.equal(requested.userAgent, BROWSER_UA);
});

test("a preview page is not handed to the video player", async () => {
  globalThis.fetch = (async () =>
    videoUpstream("<!doctype html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })) as typeof fetch;
  const response = await streamVideo(new Request("https://newsletter.test/api/media/token/clip"), clipUrl, "clip.webm");
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Photo unavailable");
});

test("a video response that leaves Dropbox is refused", async () => {
  globalThis.fetch = (async () =>
    videoUpstream(clipBytes, { status: 200, headers: { "content-type": "video/mp4" } }, "https://evil.example/clip.mov")) as typeof fetch;
  const response = await streamVideo(new Request("https://newsletter.test/api/media/token/clip"), clipUrl, "clip.mp4");
  assert.equal(response.status, 404);
});

test("a webm clip keeps its own type", async () => {
  globalThis.fetch = (async () =>
    videoUpstream(clipBytes, {
      status: 200,
      headers: { "content-type": "application/octet-stream", "content-length": "8" },
    })) as typeof fetch;
  const response = await streamVideo(new Request("https://newsletter.test/api/media/token/clip"), clipUrl, "game.webm");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/webm");
  await response.arrayBuffer();
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
