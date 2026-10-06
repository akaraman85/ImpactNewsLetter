const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v"]);

export type MediaKind = "image" | "video";

export type DropboxFile = {
  id: string;
  path: string;
  name: string;
  kind: MediaKind;
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
  if (shared && !isFolderLink(trimmed)) {
    const metadata = await dropboxJson<DropboxEntry>(
      token,
      "/sharing/get_shared_link_metadata",
      { url: trimmed },
    );
    const file = fileFromEntry({ ...metadata, ".tag": "file" });
    return file ? [file] : [];
  }

  const firstBody = shared
    ? { path: "", shared_link: { url: trimmed } }
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
