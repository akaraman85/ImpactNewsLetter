import { readStaffSession } from "@/lib/auth";
import { getAsset, getIssue } from "@/lib/data";
import { assetMediaResponse, unavailable } from "@/lib/media-response";
import { assetReadUrl } from "@/lib/media-url";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const session = await readStaffSession();
  if (!session) return new NextResponse("Sign in required", { status: 401 });
  const { assetId } = await params;
  const asset = await getAsset(assetId);
  if (!asset) return new NextResponse("Not found", { status: 404 });
  try {
    const folderUrl =
      asset.kind === "video" && !asset.sourceUrl
        ? ((await getIssue(asset.issueId))?.dropboxFolderPath ?? null)
        : null;
    return await assetMediaResponse(request, { ...asset, folderUrl }, await assetReadUrl(asset));
  } catch (error) {
    return unavailable(error);
  }
}
