import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { looksLikeImage, previewSize, resizeToJpeg } from "./image-preview.ts";
import { mediaPreviewSrc } from "./media-picker.ts";

test("grid previews ask for a thumbnail and the letter keeps the display address", () => {
  assert.equal(mediaPreviewSrc("/api/admin/media/abc", "thumb"), "/api/admin/media/abc?size=thumb");
  assert.equal(
    mediaPreviewSrc("/api/media/token/abc?size=thumb", "thumb"),
    "/api/media/token/abc?size=thumb",
  );
  assert.equal(mediaPreviewSrc("/api/admin/media/abc", "display"), "/api/admin/media/abc");
  assert.equal(mediaPreviewSrc("https://www.dropbox.com/scl/fi/abc/photo.jpg", "thumb"), "https://www.dropbox.com/scl/fi/abc/photo.jpg");
  assert.equal(previewSize("thumb"), "thumb");
  assert.equal(previewSize("full"), "display");
  assert.equal(previewSize(null), "display");
});

test("an html page is not treated as a photo", () => {
  const html = Buffer.from("<!doctype html><title>Dropbox</title>");
  assert.equal(looksLikeImage(html, "text/html"), false);
  assert.equal(looksLikeImage(Buffer.from([0xff, 0xd8, 0xff]), "application/octet-stream"), true);
  assert.equal(looksLikeImage(html, "image/jpeg"), true);
});

test("a phone-sized photo is reduced to a jpeg the browser can paint", async () => {
  const original = await sharp({
    create: { width: 5712, height: 4284, channels: 3, background: { r: 40, g: 90, b: 160 } },
  })
    .jpeg()
    .toBuffer();
  const thumb = await resizeToJpeg(original, "thumb");
  const display = await resizeToJpeg(original, "display");
  const thumbMeta = await sharp(thumb).metadata();
  const displayMeta = await sharp(display).metadata();
  assert.equal(thumbMeta.format, "jpeg");
  assert.equal(Math.max(thumbMeta.width ?? 0, thumbMeta.height ?? 0), 640);
  assert.equal(Math.max(displayMeta.width ?? 0, displayMeta.height ?? 0), 1800);
  assert.ok(thumb.byteLength < original.byteLength);
  assert.ok(display.byteLength < original.byteLength);
});
