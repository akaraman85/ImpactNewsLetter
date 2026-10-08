import { isDropboxUrl } from "./dropbox";
import { looksLikeImage, previewSize, resizeToJpeg } from "./image-preview";
import { NextResponse } from "next/server";

const MAX_SOURCE_BYTES = 40_000_000;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export async function fetchPreviewJpeg(url: string, size: ReturnType<typeof previewSize>) {
  if (!isDropboxUrl(url)) return null;
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      // Dropbox sends a zip or an HTML page to clients that do not look like a browser.
      "User-Agent": BROWSER_UA,
    },
  });
  if (!response.ok || !isDropboxUrl(response.url)) return null;
  const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const advertised = Number(response.headers.get("content-length") ?? "0");
  if (advertised > MAX_SOURCE_BYTES) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength < 32 || bytes.byteLength > MAX_SOURCE_BYTES) return null;
  if (!looksLikeImage(bytes, type)) return null;
  return resizeToJpeg(bytes, size);
}

export async function assetMediaResponse(
  request: Request,
  asset: { kind: string },
  readUrl: string | null,
) {
  if (!readUrl) return new NextResponse("Photo unavailable", { status: 404 });
  if (asset.kind === "video") {
    return NextResponse.redirect(readUrl, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  const size = previewSize(new URL(request.url).searchParams.get("size"));
  const jpeg = await fetchPreviewJpeg(readUrl, size);
  if (!jpeg) return new NextResponse("Photo unavailable", { status: 404 });
  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      "Referrer-Policy": "no-referrer",
    },
  });
}
