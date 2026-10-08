import type { PreviewSize } from "./media-picker";
import sharp from "sharp";

const MAX_EDGE: Record<PreviewSize, number> = {
  thumb: 640,
  display: 1800,
};

export function previewSize(value: string | null): PreviewSize {
  return value === "thumb" ? "thumb" : "display";
}

export function looksLikeImage(bytes: Buffer, contentType: string) {
  if (contentType.startsWith("image/")) return true;
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

// Phone photos from this folder are often 24 megapixels. Safari on a phone
// leaves those originals blank, so the preview is a JPEG small enough to paint.
export async function resizeToJpeg(bytes: Buffer, size: PreviewSize) {
  const edge = MAX_EDGE[size];
  return sharp(bytes, { failOn: "none", limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: size === "thumb" ? 72 : 82 })
    .toBuffer();
}
