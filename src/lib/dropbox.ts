const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v"]);

export type MediaKind = "image" | "video";

export type DropboxFile = {
  id: string;
  path: string;
  name: string;
  kind: MediaKind;
  sourceUrl?: string;
};

export function mediaKind(filename: string): MediaKind | null {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return null;
}

export function isDropboxUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    return host === "dropbox.com" || host.endsWith("dropboxusercontent.com");
  } catch {
    return false;
  }
}

export function dropboxRawUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host.endsWith("dropboxusercontent.com")) return url.toString();
    if (host !== "dropbox.com") return null;
    url.hostname = "www.dropbox.com";
    url.protocol = "https:";
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
    return url.toString();
  } catch {
    return null;
  }
}

export function isFolderLink(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname.replace(/^www\./, "") === "dropbox.com" &&
      /(\/sh\/|\/scl\/fo\/)/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

// Dropbox's website adds `st` and `dl` to copied links. The API rejects some of
// those URLs unless only `rlkey` remains.
export function canonicalSharedLink(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "dropbox.com") return value.trim();
    url.hostname = "www.dropbox.com";
    url.protocol = "https:";
    url.hash = "";
    const rlkey = url.searchParams.get("rlkey");
    url.search = "";
    if (rlkey) url.searchParams.set("rlkey", rlkey);
    return url.toString();
  } catch {
    return value.trim();
  }
}

const SHARED_FILE_URL =
  /https:\/\/(?:www\.)?dropbox\.com\/(?:scl\/f[io]|sh)\/[A-Za-z0-9_./%-]+\?[A-Za-z0-9_=&%.-]*/g;

function decodeName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function fileFromSharedUrl(value: string): DropboxFile | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.hostname.replace(/^www\./, "") !== "dropbox.com") return null;
  const name = decodeName(url.pathname.split("/").pop() ?? "");
  const kind = mediaKind(name);
  if (!kind) return null;
  const sourceUrl = canonicalSharedLink(url.toString());
  return {
    id: url.pathname,
    name,
    path: name,
    kind,
    sourceUrl,
  };
}

export function mediaFromSharedFolderHtml(html: string): { files: DropboxFile[]; truncated: boolean } {
  const decoded = [html];
  for (const match of html.matchAll(
    /registerStreamedPrefetch\(\s*"[A-Za-z0-9+/=_-]*"\s*,\s*"([A-Za-z0-9+/=_-]+)"/g,
  )) {
    decoded.push(Buffer.from(match[1] ?? "", "base64").toString("utf8"));
  }

  const files = new Map<string, DropboxFile>();
  let truncated = false;
  for (const chunk of decoded) {
    for (const match of chunk.matchAll(SHARED_FILE_URL)) {
      const file = fileFromSharedUrl(match[0]);
      if (!file?.sourceUrl || files.has(file.id)) continue;
      files.set(file.id, file);
    }
    const page = chunk.match(/page_size\\?":\s*(\d+),\s*\\?"page_offset\\?":\s*(\d+)/);
    if (page) {
      const pageSize = Number(page[1]);
      const pageOffset = Number(page[2]);
      if (pageSize > 0 && pageOffset >= pageSize) truncated = true;
    }
  }

  return {
    files: [...files.values()].sort((a, b) => a.name.localeCompare(b.name)),
    truncated,
  };
}

export async function listPublicDropboxMedia(folderUrl: string): Promise<DropboxFile[]> {
  if (!isFolderLink(folderUrl)) {
    throw new Error("That is not a Dropbox folder link.");
  }
  const url = new URL(canonicalSharedLink(folderUrl));
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      // Dropbox returns a zip to non-browser clients. The folder page is what lists the files.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("text/html")) {
    throw new Error("Dropbox could not open that folder. Check that anyone with the link can view it.");
  }
  const html = await response.text();
  if (html.length > 2_000_000) {
    throw new Error("Dropbox could not open that folder. Check that anyone with the link can view it.");
  }
  const listed = mediaFromSharedFolderHtml(html);
  if (listed.truncated) {
    throw new Error(
      "That folder has more files than Dropbox shows on the public page. Connect Dropbox in Settings to import all of them.",
    );
  }
  if (listed.files.length === 0) {
    throw new Error(
      "Dropbox could not open that folder. A private folder needs Dropbox connected in Settings.",
    );
  }
  return listed.files;
}

type DropboxEntry = {
  ".tag": string;
  id?: string;
  name?: string;
  path_display?: string;
  path_lower?: string;
};

type ListResponse = {
  entries?: DropboxEntry[];
  has_more?: boolean;
  cursor?: string;
};

function fileFromEntry(entry: DropboxEntry): DropboxFile | null {
  if (entry[".tag"] !== "file" || !entry.id || !entry.name) return null;
  const kind = mediaKind(entry.name);
  if (!kind) return null;
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path_display || entry.path_lower || entry.name,
    kind,
  };
}

async function dropboxJson<T>(token: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`https://api.dropboxapi.com/2${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail.slice(0, 280) || "Dropbox request failed.");
  }
  return (await response.json()) as T;
}

export async function listDropboxMedia(token: string, pathOrLink: string): Promise<DropboxFile[]> {
  const trimmed = pathOrLink.trim();
  const shared = trimmed.startsWith("http");
  const sharedUrl = shared ? canonicalSharedLink(trimmed) : trimmed;
  if (shared && !isFolderLink(sharedUrl)) {
    const metadata = await dropboxJson<DropboxEntry>(
      token,
      "/sharing/get_shared_link_metadata",
      { url: sharedUrl },
    );
    const file = fileFromEntry({ ...metadata, ".tag": "file" });
    return file ? [file] : [];
  }

  const firstBody = shared
    ? { path: "", shared_link: { url: sharedUrl } }
    : { path: trimmed.startsWith("/") ? trimmed : `/${trimmed}`, recursive: false };

  const files: DropboxFile[] = [];
  let page = await dropboxJson<ListResponse>(token, "/files/list_folder", firstBody);
  for (;;) {
    for (const entry of page.entries ?? []) {
      const file = fileFromEntry(entry);
      if (file) files.push(file);
    }
    if (!page.has_more || !page.cursor) break;
    page = await dropboxJson<ListResponse>(token, "/files/list_folder/continue", {
      cursor: page.cursor,
    });
  }
  return files;
}

export async function temporaryLink(token: string, path: string) {
  const result = await dropboxJson<{ link: string }>(token, "/files/get_temporary_link", {
    path,
  });
  return result.link;
}

export async function currentAccount(token: string) {
  const response = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const account = (await response.json()) as {
    account_id?: string;
    email?: string;
    name?: { display_name?: string };
  };
  return {
    id: account.account_id ?? "",
    label: account.email || account.name?.display_name || "Dropbox account",
  };
}
