"use server";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { draftNewsletter } from "./ai";
import { clearStaffSession, grantViewer, requireStaff, startStaffSession } from "./auth";
import { emptyContent, type NewsletterContent } from "./content";
import { findStaffByEmail, getIssue, getSettings, listAssets } from "./data";
import { dropboxAccessToken } from "./dropbox-account";
import {
  isDropboxUrl,
  isFolderLink,
  listDropboxMedia,
  listPublicDropboxMedia,
  mediaKind,
  type DropboxFile,
} from "./dropbox";
import { withDb } from "./db";
import {
  encryptSecret,
  hashPassword,
  hashToken,
  isShareToken,
  newShareToken,
  verifyPassword,
} from "./secrets";
import { assets, issues, programSettings, shareLinks, staffUsers } from "./schema";
import { isOwner, setupCodeMatches, staffSignupOpen } from "./staff-access";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bounce(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function setupStaff(formData: FormData) {
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const code = text(formData, "code");
  if (!staffSignupOpen() || !isOwner(email) || !setupCodeMatches(code)) {
    bounce("/admin/setup", "Staff signup is closed.");
  }
  if (name.length < 2) bounce("/admin/setup", "Add your name.");
  if (!email.includes("@") || email.length > 200) bounce("/admin/setup", "Use a real email address.");
  if (password.length < 10) bounce("/admin/setup", "Use a password of at least 10 characters.");

  const id = randomUUID();
  const created = await withDb(async (db) => {
    return db.transaction(async (tx) => {
      const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(staffUsers);
      if ((row?.count ?? 0) > 0) return false;
      await tx.insert(staffUsers).values({
        id,
        email,
        name,
        passwordHash: hashPassword(password),
      });
      return true;
    });
  });
  if (!created) bounce("/admin/login", "A staff account already exists. Sign in.");
  await startStaffSession(id);
  redirect("/admin");
}

export async function login(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const staff = await findStaffByEmail(email);
  if (!staff || !verifyPassword(password, staff.passwordHash)) {
    bounce("/admin/login", "That email and password did not match.");
  }
  await startStaffSession(staff.id);
  redirect("/admin");
}

export async function logout() {
  await clearStaffSession();
  redirect("/admin/login");
}

export async function addStaff(formData: FormData) {
  const staff = await requireStaff();
  if (!isOwner(staff.email)) bounce("/admin/settings", "Only the owner can add a staff account.");
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  if (name.length < 2 || !email.includes("@") || password.length < 10) {
    bounce("/admin/settings", "Name, email, and a 10-character password are required.");
  }
  const existing = await findStaffByEmail(email);
  if (existing) bounce("/admin/settings", "That email already has a staff account.");
  await withDb(async (db) => {
    await db.insert(staffUsers).values({
      id: randomUUID(),
      email,
      name,
      passwordHash: hashPassword(password),
    });
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function saveProgram(formData: FormData) {
  await requireStaff();
  const programName = text(formData, "programName") || "Impact Newsletter";
  const tagline = text(formData, "tagline");
  const folder = text(formData, "dropboxFolderPath");
  await withDb(async (db) => {
    await db
      .update(programSettings)
      .set({
        programName: programName.slice(0, 120),
        tagline: tagline.slice(0, 180),
        dropboxFolderPath: folder.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(programSettings.id, 1));
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function saveViewerPassword(formData: FormData) {
  await requireStaff();
  const password = text(formData, "viewerPassword");
  const clear = formData.get("clear") === "1";
  if (!clear && password.length > 0 && password.length < 6) {
    bounce("/admin/settings", "The family passphrase needs at least 6 characters.");
  }
  await withDb(async (db) => {
    await db
      .update(programSettings)
      .set({
        viewerPasswordHash: clear || password.length === 0 ? null : hashPassword(password),
        updatedAt: new Date(),
      })
      .where(eq(programSettings.id, 1));
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function disconnectDropbox() {
  await requireStaff();
  await withDb(async (db) => {
    await db
      .update(programSettings)
      .set({
        dropboxRefreshToken: null,
        dropboxAccountId: null,
        dropboxAccountLabel: null,
        updatedAt: new Date(),
      })
      .where(eq(programSettings.id, 1));
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function createIssue(formData: FormData) {
  await requireStaff();
  const title = text(formData, "title");
  const eventDate = text(formData, "eventDate");
  const notes = text(formData, "notes");
  if (title.length < 2) bounce("/admin/issues/new", "Give the issue a title.");
  const settings = await getSettings();
  const folder = formData.has("dropboxFolderPath")
    ? text(formData, "dropboxFolderPath")
    : settings.dropboxFolderPath;
  const id = randomUUID();
  await withDb(async (db) => {
    await db.insert(issues).values({
      id,
      title: title.slice(0, 160),
      eventDate: eventDate || null,
      notes: notes.slice(0, 8000),
      status: "draft",
      content: emptyContent(title.slice(0, 160)),
      dropboxFolderPath: folder.slice(0, 500),
    });
  });
  redirect(`/admin/issues/${id}`);
}

export async function saveIssueDetails(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const title = text(formData, "title");
  if (title.length < 2) bounce(`/admin/issues/${id}`, "The title needs a few letters.");
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({
        title: title.slice(0, 160),
        eventDate: text(formData, "eventDate") || null,
        notes: text(formData, "notes").slice(0, 8000),
        dropboxFolderPath: text(formData, "dropboxFolderPath").slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id));
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}`);
}

function importFailure(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && !message.startsWith("{") && !message.includes("error_summary")) {
      return message.slice(0, 240);
    }
  }
  return "Dropbox could not open that folder. Check the path and the connection.";
}

export async function importDropboxFolder(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const issue = await getIssue(id);
  if (!issue) bounce("/admin", "That issue is gone.");
  const folder = text(formData, "dropboxFolderPath") || issue.dropboxFolderPath;
  if (!folder) bounce(`/admin/issues/${id}`, "Add a Dropbox folder path or shared folder link.");
  let files: DropboxFile[] | undefined;
  try {
    const token = await dropboxAccessToken();
    if (token) {
      try {
        files = await listDropboxMedia(token, folder);
      } catch (error) {
        unstable_rethrow(error);
        if (!isFolderLink(folder)) throw error;
        files = [];
      }
      if (files.length === 0 && isFolderLink(folder)) {
        files = await listPublicDropboxMedia(folder);
      }
    } else if (isFolderLink(folder)) {
      files = await listPublicDropboxMedia(folder);
    } else {
      bounce(`/admin/issues/${id}`, "Connect Dropbox in Settings before importing a private folder.");
    }
  } catch (error) {
    unstable_rethrow(error);
    bounce(`/admin/issues/${id}`, importFailure(error));
  }
  if (!files || files.length === 0) {
    bounce(`/admin/issues/${id}`, "That folder does not have any photos or videos.");
  }
  const existing = await listAssets(id);
  const known = new Set(
    existing.flatMap((asset) => [asset.dropboxId, asset.sourceUrl].filter((value) => Boolean(value))),
  );
  let order = existing.reduce((max, asset) => Math.max(max, asset.sortOrder), 0);
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({ dropboxFolderPath: folder.slice(0, 500), updatedAt: new Date() })
      .where(eq(issues.id, id));
    for (const file of files) {
      if (known.has(file.id) || (file.sourceUrl && known.has(file.sourceUrl))) continue;
      order += 1;
      await db.insert(assets).values({
        id: randomUUID(),
        issueId: id,
        sortOrder: order,
        included: true,
        kind: file.kind,
        name: file.name,
        dropboxId: file.id,
        dropboxPath: file.sourceUrl ? null : file.path,
        sourceUrl: file.sourceUrl?.slice(0, 1000) ?? null,
        caption: "",
      });
    }
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}`);
}

export async function addMediaLink(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const url = text(formData, "url");
  const name = text(formData, "name") || "Photo";
  if (!isDropboxUrl(url)) {
    bounce(`/admin/issues/${id}`, "Paste a Dropbox file link.");
  }
  const kind = mediaKind(name) ?? mediaKind(url) ?? "image";
  const existing = await listAssets(id);
  const order = existing.reduce((max, asset) => Math.max(max, asset.sortOrder), 0) + 1;
  await withDb(async (db) => {
    await db.insert(assets).values({
      id: randomUUID(),
      issueId: id,
      sortOrder: order,
      included: true,
      kind,
      name: name.slice(0, 180),
      sourceUrl: url.slice(0, 1000),
      caption: "",
    });
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}`);
}

export async function saveAssets(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const rows = await listAssets(id);
  await withDb(async (db) => {
    for (const asset of rows) {
      const included = formData.getAll("included").includes(asset.id);
      const caption = text(formData, `caption-${asset.id}`).slice(0, 300);
      await db
        .update(assets)
        .set({ included, caption })
        .where(and(eq(assets.id, asset.id), eq(assets.issueId, id)));
    }
    await db.update(issues).set({ updatedAt: new Date() }).where(eq(issues.id, id));
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}`);
}

export async function moveAsset(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const move = text(formData, "move");
  const [assetId, directionName] = move.split(":");
  const direction = directionName === "up" ? -1 : 1;
  const rows = await listAssets(id);
  const index = rows.findIndex((asset) => asset.id === assetId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) redirect(`/admin/issues/${id}`);
  const next = [...rows];
  const [moved] = next.splice(index, 1);
  if (!moved) redirect(`/admin/issues/${id}`);
  next.splice(target, 0, moved);
  await withDb(async (db) => {
    for (const [order, asset] of next.entries()) {
      await db.update(assets).set({ sortOrder: order }).where(eq(assets.id, asset.id));
    }
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}`);
}

export async function removeAsset(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const assetId = text(formData, "assetId");
  await withDb(async (db) => {
    await db.delete(assets).where(and(eq(assets.id, assetId), eq(assets.issueId, id)));
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}`);
}

function contentFromForm(formData: FormData, fallback: string): NewsletterContent {
  const sectionCount = Number(text(formData, "sectionCount") || "0");
  const sections = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const id = text(formData, `section-id-${index}`) || `section-${index + 1}`;
    sections.push({
      id,
      heading: text(formData, `section-heading-${index}`).slice(0, 160),
      body: text(formData, `section-body-${index}`).slice(0, 4000),
      assetIds: formData
        .getAll(`section-assets-${index}`)
        .filter((value): value is string => typeof value === "string"),
    });
  }
  return {
    headline: text(formData, "headline").slice(0, 180) || fallback,
    subtitle: text(formData, "subtitle").slice(0, 220),
    intro: text(formData, "intro").slice(0, 4000),
    sections,
    closing: text(formData, "closing").slice(0, 2000),
  };
}

export async function saveLetter(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const issue = await getIssue(id);
  if (!issue) bounce("/admin", "That issue is gone.");
  const content = contentFromForm(formData, issue.title);
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({ content, updatedAt: new Date() })
      .where(eq(issues.id, id));
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}`);
}

export async function addSection(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const issue = await getIssue(id);
  if (!issue) bounce("/admin", "That issue is gone.");
  const content = contentFromForm(formData, issue.title);
  content.sections.push({
    id: randomUUID(),
    heading: "",
    body: "",
    assetIds: [],
  });
  await withDb(async (db) => {
    await db.update(issues).set({ content, updatedAt: new Date() }).where(eq(issues.id, id));
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}#letter`);
}

export async function writeDraft(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const issue = await getIssue(id);
  if (!issue) bounce("/admin", "That issue is gone.");
  const notes = text(formData, "notes") || issue.notes;
  if (notes.length < 12) {
    bounce(`/admin/issues/${id}`, "Add a few sentences of notes before writing a draft.");
  }
  const [settings, media] = await Promise.all([getSettings(), listAssets(id)]);
  let content;
  try {
    content = await draftNewsletter({
      title: issue.title,
      eventDate: issue.eventDate,
      notes,
      programName: settings.programName,
      assets: media,
    });
  } catch {
    bounce(
      `/admin/issues/${id}`,
      "The draft could not be written. You can still write the letter by hand, and check the AI Gateway key if drafts keep failing.",
    );
  }
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({ notes: notes.slice(0, 8000), content, updatedAt: new Date() })
      .where(eq(issues.id, id));
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}#letter`);
}

async function createShareLink(issueId: string, days: number | null) {
  const token = newShareToken();
  const expiresAt =
    days && days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  await withDb(async (db) => {
    await db.insert(shareLinks).values({
      id: randomUUID(),
      issueId,
      tokenHash: hashToken(token),
      tokenEncrypted: encryptSecret(token),
      expiresAt,
    });
  });
}

export async function publishIssue(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const issue = await getIssue(id);
  if (!issue) bounce("/admin", "That issue is gone.");
  const daysRaw = text(formData, "expiresInDays");
  const days = daysRaw ? Number(daysRaw) : null;
  if (days !== null && (!Number.isFinite(days) || days < 1 || days > 365)) {
    bounce(`/admin/issues/${id}`, "Expiry should be a number of days between 1 and 365.");
  }
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({
        status: "published",
        publishedAt: issue.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id));
  });
  const links = await withDb(async (db) => {
    return db.select().from(shareLinks).where(eq(shareLinks.issueId, id));
  });
  const active = links.some((link) => !link.revokedAt);
  if (!active) await createShareLink(id, days);
  revalidatePath(`/admin/issues/${id}`);
  revalidatePath("/admin");
  redirect(`/admin/issues/${id}#share`);
}

export async function unpublishIssue(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(issues.id, id));
  });
  revalidatePath(`/admin/issues/${id}`);
  revalidatePath("/admin");
  redirect(`/admin/issues/${id}`);
}

export async function createLink(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const daysRaw = text(formData, "expiresInDays");
  const days = daysRaw ? Number(daysRaw) : null;
  await createShareLink(id, days && Number.isFinite(days) ? days : null);
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}#share`);
}

export async function revokeLink(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  const linkId = text(formData, "linkId");
  await withDb(async (db) => {
    await db
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLinks.id, linkId), eq(shareLinks.issueId, id)));
  });
  revalidatePath(`/admin/issues/${id}`);
  redirect(`/admin/issues/${id}#share`);
}

export async function unlockViewer(formData: FormData) {
  const token = text(formData, "token");
  const password = text(formData, "password");
  if (!isShareToken(token)) redirect("/");
  const settings = await getSettings();
  if (!settings.viewerPasswordHash || !verifyPassword(password, settings.viewerPasswordHash)) {
    bounce(`/v/${token}`, "That passphrase did not match.");
  }
  await grantViewer(token, settings.viewerPasswordHash.slice(0, 16));
  redirect(`/v/${token}`);
}

export async function archiveIssue(formData: FormData) {
  await requireStaff();
  const id = text(formData, "id");
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(issues.id, id));
  });
  revalidatePath("/admin");
  redirect("/admin");
}
