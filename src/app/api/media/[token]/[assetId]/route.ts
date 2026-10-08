import { viewerGranted } from "@/lib/auth";
import { findActiveShare, getAsset, getSettings } from "@/lib/data";
import { assetMediaResponse } from "@/lib/media-response";
import { assetReadUrl } from "@/lib/media-url";
import { hashToken, isShareToken } from "@/lib/secrets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; assetId: string }> },
) {
  const { token, assetId } = await params;
  if (!isShareToken(token)) return new NextResponse("Not found", { status: 404 });
  const found = await findActiveShare(hashToken(token));
  if (!found) return new NextResponse("Not found", { status: 404 });
  const settings = await getSettings();
  if (settings.viewerPasswordHash) {
    const allowed = await viewerGranted(token, settings.viewerPasswordHash.slice(0, 16));
    if (!allowed) return new NextResponse("Not found", { status: 404 });
  }
  const asset = await getAsset(assetId);
  if (!asset || asset.issueId !== found.issue.id || !asset.included) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    return await assetMediaResponse(request, asset, await assetReadUrl(asset));
  } catch {
    return new NextResponse("Photo unavailable", { status: 404 });
  }
}
