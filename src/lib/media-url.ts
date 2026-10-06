import type { Asset } from "./data";
import { dropboxAccessToken } from "./dropbox-account";
import { dropboxRawUrl, isDropboxUrl, temporaryLink } from "./dropbox";

export async function assetReadUrl(asset: Asset) {
  if (asset.sourceUrl) {
    const raw = dropboxRawUrl(asset.sourceUrl);
    return raw && isDropboxUrl(raw) ? raw : null;
  }
  const path = asset.dropboxPath || asset.dropboxId;
  if (!path) return null;
  const token = await dropboxAccessToken();
  if (!token) return null;
  const link = await temporaryLink(token, path);
  return isDropboxUrl(link) ? link : null;
}
