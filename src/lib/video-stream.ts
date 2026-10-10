import { BROWSER_UA, dropboxDownloadUrl, isDropboxUrl } from "./dropbox";
import { videoSourceType } from "./section-gallery";

function miss(error?: unknown) {
  if (error) {
    const message = error instanceof Error ? error.message : "video failed";
    console.warn(`preview unavailable: ${message.replace(/https?:\/\/\S+/g, "[link]").slice(0, 160)}`);
  }
  return new Response("Photo unavailable", { status: 404 });
}

function byteRange(request: Request) {
  const range = request.headers.get("range")?.trim() ?? "";
  return /^bytes=\d*-\d*$/.test(range) ? range : null;
}

// A preview page, a zip, or a photo is not a video. Octet-stream is the file
// itself with a type the player will not accept, so that one is relabeled.
function unplayableUpstream(type: string) {
  const normalized = type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!normalized || normalized.startsWith("video/")) return false;
  return (
    normalized !== "application/octet-stream" &&
    normalized !== "application/binary" &&
    normalized !== "binary/octet-stream" &&
    normalized !== "application/mp4" &&
    normalized !== "application/force-download"
  );
}

function videoHeaders(name: string, upstream: Response) {
  const headers = new Headers();
  headers.set("Content-Type", videoSourceType(name));
  headers.set("Content-Disposition", "inline");
  // Safari will not play a video it is not allowed to cache, and it seeks with
  // Range. Keep the file private to this browser for the viewing session.
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Referrer-Policy", "no-referrer");
  if (upstream.status === 206) headers.set("Accept-Ranges", "bytes");
  else {
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
  }
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  const length = upstream.headers.get("content-length");
  if (length && !upstream.headers.get("content-encoding")) headers.set("Content-Length", length);
  return headers;
}

// A redirect leaves playback on Dropbox's response. That response is often a
// preview page or a type the video element refuses, and Safari drops the clip
// when the media address hops to another site. Stream the bytes from this
// origin instead, and forward Range so the player can start and seek.
export async function streamVideo(request: Request, readUrl: string, name: string) {
  const downloadUrl = dropboxDownloadUrl(readUrl);
  if (!downloadUrl || !isDropboxUrl(downloadUrl)) return miss();
  const headers = new Headers();
  const range = byteRange(request);
  if (range) headers.set("Range", range);
  headers.set("Accept", "*/*");
  headers.set("User-Agent", BROWSER_UA);
  let upstream: Response;
  try {
    upstream = await fetch(downloadUrl, {
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return miss(error);
  }
  if (upstream.status === 416) {
    const responseHeaders = videoHeaders(name, upstream);
    responseHeaders.set("Accept-Ranges", "bytes");
    await upstream.body?.cancel();
    return new Response(null, { status: 416, headers: responseHeaders });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (
    (upstream.status !== 200 && upstream.status !== 206) ||
    !isDropboxUrl(upstream.url) ||
    unplayableUpstream(type) ||
    !upstream.body
  ) {
    await upstream.body?.cancel();
    return miss(new Error("dropbox did not return a video"));
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: videoHeaders(name, upstream),
  });
}
