import { dropboxPosterUrl, sharedVideoUrl } from "./dropbox";
import { previewSize } from "./image-preview";
import { fetchPreviewJpeg } from "./preview-bytes";
import { streamVideo } from "./video-stream";
import { NextResponse } from "next/server";

function safeReason(error: unknown) {
  const message = error instanceof Error ? error.message : "preview failed";
  return message.replace(/https?:\/\/\S+/g, "[link]").slice(0, 160);
}

export function unavailable(error?: unknown) {
  if (error) console.warn(`preview unavailable: ${safeReason(error)}`);
  return new NextResponse("Photo unavailable", { status: 404 });
}

function jpegResponse(jpeg: Buffer) {
  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function assetMediaResponse(
  request: Request,
  asset: { kind: string; name?: string; sourceUrl?: string | null; folderUrl?: string | null },
  readUrl: string | null,
) {
  const requested = new URL(request.url).searchParams.get("size");
  if (asset.kind === "video" && requested) {
    const shared =
      asset.sourceUrl ||
      (asset.folderUrl && asset.name ? await sharedVideoUrl(asset.folderUrl, asset.name) : null);
    const poster = shared ? dropboxPosterUrl(shared, previewSize(requested)) : null;
    if (!poster) return unavailable();
    try {
      const jpeg = await fetchPreviewJpeg(poster, previewSize(requested));
      if (!jpeg) return unavailable();
      return jpegResponse(jpeg);
    } catch (error) {
      return unavailable(error);
    }
  }
  if (!readUrl) return unavailable();
  if (asset.kind === "video") return streamVideo(request, readUrl, asset.name ?? "");
  const size = previewSize(requested);
  try {
    const jpeg = await fetchPreviewJpeg(readUrl, size);
    if (!jpeg) return unavailable();
    return jpegResponse(jpeg);
  } catch (error) {
    return unavailable(error);
  }
}
