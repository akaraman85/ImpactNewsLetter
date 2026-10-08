import { isDropboxUrl } from "./dropbox";
import { looksLikeImage, previewSize, resizeToJpeg } from "./image-preview";
import { createSlotQueue } from "./preview-queue";

const MAX_SOURCE_BYTES = 40_000_000;
const ATTEMPTS = 2;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const previewCache = new Map<string, Buffer>();
const inflight = new Map<string, Promise<Buffer | null>>();
const downloads = createSlotQueue(2);
const MAX_CACHE = 48;

function remember(key: string, value: Buffer) {
  previewCache.delete(key);
  previewCache.set(key, value);
  while (previewCache.size > MAX_CACHE) {
    const oldest = previewCache.keys().next().value;
    if (!oldest) break;
    previewCache.delete(oldest);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function dropboxRetryable(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function miss(reason: string) {
  console.warn(`preview unavailable: ${reason}`);
  return null;
}

async function readDropboxImage(url: string) {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          // Dropbox sends a zip or an HTML page to clients that do not look like a browser.
          "User-Agent": BROWSER_UA,
        },
      });
    } catch (error) {
      if (attempt === ATTEMPTS - 1) throw error;
      await wait(200);
      continue;
    }
    if (!response.ok || !isDropboxUrl(response.url)) {
      const retry = dropboxRetryable(response.status);
      await response.body?.cancel();
      if (!retry || attempt === ATTEMPTS - 1) return miss(`dropbox ${response.status}`);
      await wait(250);
      continue;
    }
    const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    const advertised = Number(response.headers.get("content-length") ?? "0");
    if (advertised > MAX_SOURCE_BYTES) {
      await response.body?.cancel();
      return miss("file is too large");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < 32 || bytes.byteLength > MAX_SOURCE_BYTES) return miss("file is too large");
    if (!looksLikeImage(bytes, type)) {
      if (attempt === ATTEMPTS - 1 || !type.startsWith("text/")) return miss(type || "not an image");
      await wait(200);
      continue;
    }
    return bytes;
  }
  return null;
}

export async function fetchPreviewJpeg(url: string, size: ReturnType<typeof previewSize>) {
  if (!isDropboxUrl(url)) return miss("not a dropbox link");
  const key = `${size}\n${url}`;
  const cached = previewCache.get(key);
  if (cached) {
    remember(key, cached);
    return cached;
  }
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const release = await downloads.acquire();
    try {
      const again = previewCache.get(key);
      if (again) return again;
      const bytes = await readDropboxImage(url);
      if (!bytes) return null;
      const jpeg = await resizeToJpeg(bytes, size);
      remember(key, jpeg);
      return jpeg;
    } finally {
      release();
    }
  })().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, job);
  return job;
}

export function resetPreviewState() {
  previewCache.clear();
  inflight.clear();
}
