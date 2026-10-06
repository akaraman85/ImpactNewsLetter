import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { NewsletterContent } from "./content";

export const programSettings = pgTable("program_settings", {
  id: integer("id").primaryKey(),
  programName: text("program_name").notNull(),
  tagline: text("tagline").notNull(),
  viewerPasswordHash: text("viewer_password_hash"),
  dropboxRefreshToken: text("dropbox_refresh_token"),
  dropboxAccountId: text("dropbox_account_id"),
  dropboxAccountLabel: text("dropbox_account_label"),
  dropboxFolderPath: text("dropbox_folder_path").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  eventDate: date("event_date", { mode: "string" }),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("draft"),
  content: jsonb("content").$type<NewsletterContent>().notNull(),
  dropboxFolderPath: text("dropbox_folder_path").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey(),
  issueId: uuid("issue_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  included: boolean("included").notNull().default(true),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  dropboxId: text("dropbox_id"),
  dropboxPath: text("dropbox_path"),
  sourceUrl: text("source_url"),
  caption: text("caption").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey(),
  issueId: uuid("issue_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenEncrypted: text("token_encrypted").notNull(),
  label: text("label").notNull().default("Family link"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
