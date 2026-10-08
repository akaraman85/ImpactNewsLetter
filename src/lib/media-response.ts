import { previewSize } from "./image-preview";
import { fetchPreviewJpeg } from "./preview-bytes";
import { NextResponse } from "next/server";

function safeReason(error: unknown) {
  const message = error instanceof Error ? error.message : "preview failed";
  return message.replace(/https?:\/\/\S+/g, "[link]").slice(0, 160);
}

export function unavailable(error?: unknown) {
  if (error) console.warn(`preview unavailable: ${safeReason(error)}`);
  return new NextResponse("Photo unavailable", { status: 404 });
}

export async function assetMediaResponse(
  request: Request,
  asset: { kind: string },
  readUrl: string | null,
) {
  if (!readUrl) return unavailable();
  if (asset.kind === "video") {
    return NextResponse.redirect(readUrl, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  const size = previewSize(new URL(request.url).searchParams.get("size"));
  try {
    const jpeg = await fetchPreviewJpeg(readUrl, size);
    if (!jpeg) return unavailable();
    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return unavailable(error);
  }
}
