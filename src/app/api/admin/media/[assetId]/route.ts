import { readStaffSession } from "@/lib/auth";
import { getAsset } from "@/lib/data";
import { assetReadUrl } from "@/lib/media-url";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const session = await readStaffSession();
  if (!session) return new NextResponse("Sign in required", { status: 401 });
  const { assetId } = await params;
  const asset = await getAsset(assetId);
  if (!asset) return new NextResponse("Not found", { status: 404 });
  try {
    const url = await assetReadUrl(asset);
    if (!url) return new NextResponse("Photo unavailable", { status: 404 });
    return NextResponse.redirect(url, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new NextResponse("Photo unavailable", { status: 404 });
  }
}
