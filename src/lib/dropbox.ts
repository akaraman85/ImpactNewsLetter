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
const CONTINUATION_VOUCHER =
  /\{"prog":\s*"(?:\\.|[^"\\])*"\s*,\s*"sig":\s*"(?:\\.|[^"\\])*"\s*\}/;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const MAX_SHARED_PAGES = 40;

export type SharedFolderRequest = {
  linkKey: string;
  linkType: "c" | "s";
  secureHash: string;
  subPath: string;
  rlkey: string | null;
};

export type SharedFolderEntry = {
  is_dir?: boolean;
  filename?: string;
  href?: string;
};

export type SharedFolderPage = {
  entries?: SharedFolderEntry[];
  has_more_entries?: boolean;
  next_request_voucher?: string | null;
};

// Dropbox's public folder page only embeds the first screen of files. The
// link key, content hash, and rlkey are what the folder listing request uses
// to ask for the rest.
export function sharedFolderRequest(value: string): SharedFolderRequest | null {
  let url: URL;
  try {
    url = new URL(canonicalSharedLink(value));
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  let linkType: "c" | "s" | null = null;
  let rest: string[] = [];
  if (parts[0] === "scl" && parts[1] === "fo") {
    linkType = "c";
    rest = parts.slice(2);
  } else if (parts[0] === "sh") {
    linkType = "s";
    rest = parts.slice(1);
  }
  const [linkKey, secureHash, ...subPath] = rest;
  if (!linkType || !linkKey || !secureHash) return null;
  return {
    linkKey,
    linkType,
    secureHash: decodeName(secureHash),
    subPath: subPath.map((part) => decodeName(part)).join("/"),
    rlkey: url.searchParams.get("rlkey"),
  };
}

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
    if (CONTINUATION_VOUCHER.test(chunk)) truncated = true;
  }

  return {
    files: [...files.values()].sort((a, b) => a.name.localeCompare(b.name)),
    truncated,
  };
}

function childFolderPath(parent: string, name: string) {
  const clean = name.replaceAll("/", "").trim();
  if (!clean) return null;
  if (!parent) return `/${clean}`;
  return `${parent.replace(/\/$/, "")}/${clean}`;
}

export async function listAllSharedEntries(
  load: (subPath: string, voucher?: string) => Promise<SharedFolderPage>,
): Promise<DropboxFile[]> {
  const files = new Map<string, DropboxFile>();
  const pending = [""];
  const seenPaths = new Set<string>();
  let pages = 0;

  while (pending.length > 0) {
    const subPath = pending.shift() ?? "";
    if (seenPaths.has(subPath)) continue;
    seenPaths.add(subPath);
    let voucher: string | undefined;
    const seenVouchers = new Set<string>();

    for (;;) {
      pages += 1;
      if (pages > MAX_SHARED_PAGES) {
        throw new Error(
          "That folder has more files than Dropbox shows on the public page. Connect Dropbox in Settings to import all of them.",
        );
      }
      const page = await load(subPath, voucher);
      for (const entry of page.entries ?? []) {
        if (entry.is_dir) {
          const next = entry.filename ? childFolderPath(subPath, entry.filename) : null;
          if (next && !seenPaths.has(next)) pending.push(next);
          continue;
        }
        if (!entry.href) continue;
        const file = fileFromSharedUrl(entry.href);
        if (!file?.sourceUrl) continue;
        files.set(file.id, file);
      }
      const nextVoucher = page.next_request_voucher?.trim() ?? "";
      if (!page.has_more_entries) break;
      if (!nextVoucher || seenVouchers.has(nextVoucher)) {
        throw new Error("Dropbox could not list the rest of that folder. Try Import folder again.");
      }
      seenVouchers.add(nextVoucher);
      voucher = nextVoucher;
    }
  }

  return [...files.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function dropboxPageSession(headers: Headers) {
  const cookies = new Map<string, string>();
  const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    const pair = cookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  const csrf = cookies.get("t");
  if (!csrf) return null;
  return {
    csrf,
    cookie: [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}

async function postSharedFolderPage(
  pageUrl: string,
  target: SharedFolderRequest,
  session: { csrf: string; cookie: string },
  subPath: string,
  voucher?: string,
): Promise<SharedFolderPage> {
  const paths = subPath.startsWith("/") ? [subPath, subPath.slice(1)] : [subPath];
  let lastStatus = 0;
  for (const [index, path] of paths.entries()) {
    const body = new URLSearchParams({
      is_xhr: "true",
      t: session.csrf,
      link_key: target.linkKey,
      link_type: target.linkType,
      secure_hash: target.secureHash,
      sub_path: path,
    });
    if (target.rlkey) body.set("rlkey", target.rlkey);
    if (voucher) body.set("voucher", voucher);
    const response = await fetch("https://www.dropbox.com/list_shared_link_folder_entries", {
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://www.dropbox.com",
        Referer: pageUrl,
        "User-Agent": BROWSER_UA,
        Cookie: session.cookie,
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
      cache: "no-store",
      redirect: "manual",
    });
    lastStatus = response.status;
    if (response.status === 404 && index < paths.length - 1 && !voucher) continue;
    if (!response.ok) break;
    const page = (await response.json()) as SharedFolderPage;
    if (!Array.isArray(page.entries)) {
      throw new Error("Dropbox could not list the rest of that folder. Try Import folder again.");
    }
    return page;
  }
  if (lastStatus === 404 && subPath) {
    return { entries: [], has_more_entries: false };
  }
  throw new Error("Dropbox could not list the rest of that folder. Try Import folder again.");
}

export async function listPublicDropboxMedia(folderUrl: string): Promise<DropboxFile[]> {
  if (!isFolderLink(folderUrl)) {
    throw new Error("That is not a Dropbox folder link.");
  }
  const pageUrl = canonicalSharedLink(folderUrl);
  const response = await fetch(pageUrl, {
    headers: {
      Accept: "text/html",
      // Dropbox returns a zip to non-browser clients. The folder page is what lists the files.
      "User-Agent": BROWSER_UA,
    },
    redirect: "follow",
    cache: "no-store",
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
  const session = dropboxPageSession(response.headers);
  const target = sharedFolderRequest(pageUrl);
  if (session && target) {
    try {
      const files = await listAllSharedEntries((subPath, voucher) =>
        postSharedFolderPage(pageUrl, target, session, subPath, voucher),
      );
      if (files.length > 0) return files;
    } catch (error) {
      if (listed.truncated || listed.files.length === 0) throw error;
    }
  } else if (listed.truncated) {
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
