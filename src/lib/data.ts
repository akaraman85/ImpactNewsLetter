import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { emptyContent, parseContent, type NewsletterContent } from "./content";
import { withDb } from "./db";
import { assets, issues, programSettings, shareLinks, staffUsers } from "./schema";

export type Staff = typeof staffUsers.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type Settings = typeof programSettings.$inferSelect;

const defaultSettings = {
  id: 1,
  programName: "Impact Newsletter",
  tagline: "Notes home from the program",
  viewerPasswordHash: null,
  dropboxRefreshToken: null,
  dropboxAccountId: null,
  dropboxAccountLabel: null,
  dropboxFolderPath: "",
  updatedAt: new Date(),
} satisfies Settings;

export async function getSettings(): Promise<Settings> {
  return withDb(async (db) => {
    const [row] = await db.select().from(programSettings).where(eq(programSettings.id, 1)).limit(1);
    return row ?? defaultSettings;
  });
}

export async function staffCount() {
  return withDb(async (db) => {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(staffUsers);
    return row?.count ?? 0;
  });
}

export async function findStaffByEmail(email: string) {
  return withDb(async (db) => {
    const [row] = await db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.email, email.toLowerCase()))
      .limit(1);
    return row ?? null;
  });
}

export async function findStaff(id: string) {
  return withDb(async (db) => {
    const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, id)).limit(1);
    return row ?? null;
  });
}

export async function listStaff() {
  return withDb(async (db) => {
    return db.select().from(staffUsers).orderBy(asc(staffUsers.createdAt));
  });
}

export async function listIssues() {
  return withDb(async (db) => {
    return db.select().from(issues).orderBy(desc(issues.updatedAt));
  });
}

export async function getIssue(id: string) {
  return withDb(async (db) => {
    const [row] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
    return row ?? null;
  });
}

export async function listAssets(issueId: string) {
  return withDb(async (db) => {
    return db.select().from(assets).where(eq(assets.issueId, issueId)).orderBy(asc(assets.sortOrder));
  });
}

export async function getAsset(id: string) {
  return withDb(async (db) => {
    const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return row ?? null;
  });
}

export async function listShareLinks(issueId: string) {
  return withDb(async (db) => {
    return db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.issueId, issueId))
      .orderBy(desc(shareLinks.createdAt));
  });
}

export async function findActiveShare(tokenHash: string) {
  return withDb(async (db) => {
    const [row] = await db
      .select({ link: shareLinks, issue: issues })
      .from(shareLinks)
      .innerJoin(issues, eq(issues.id, shareLinks.issueId))
      .where(
        and(
          eq(shareLinks.tokenHash, tokenHash),
          isNull(shareLinks.revokedAt),
          eq(issues.status, "published"),
          sql`(${shareLinks.expiresAt} is null or ${shareLinks.expiresAt} > now())`,
        ),
      )
      .limit(1);
    return row ?? null;
  });
}

export function issueContent(issue: Issue) {
  return parseContent(issue.content, issue.title);
}

export async function saveContent(issueId: string, content: NewsletterContent) {
  await withDb(async (db) => {
    await db
      .update(issues)
      .set({ content, updatedAt: new Date() })
      .where(eq(issues.id, issueId));
  });
}

export { emptyContent };
