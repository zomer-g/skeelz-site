import { sql } from "drizzle-orm";
import { bigserial, boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/*
 * CV RULE (see CLAUDE.md): no table here holds a CV, a file name, a file hash or
 * anything derived from a file. A CV passes through the apply action in memory
 * and goes only to the CRM.
 */

/* ------------------------------------------------------------------ audit */

/** Admin changes: texts, pins, banners. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: ts("at").notNull().defaultNow(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    details: jsonb("details"),
  },
  (t) => [index("audit_log_at_idx").on(t.at), index("audit_log_actor_at_idx").on(t.actor, t.at)],
);

/* ------------------------------------------------------------------ texts */

/** Admin-edited copy (hero, about, footer, privacy, accessibility); src/lib/texts/registry.ts lists them. */
export const siteTexts = pgTable("site_texts", {
  key: text("key").primaryKey(),
  body: text("body").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Every saved version of a text, so any edit can be undone. The newest version is the current text. */
export const siteTextVersions = pgTable(
  "site_text_versions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: text("key").notNull(),
    body: text("body").notNull(),
    savedBy: text("saved_by").notNull(),
    savedAt: ts("saved_at").notNull().defaultNow(),
  },
  (t) => [index("site_text_versions_key_idx").on(t.key, t.id)],
);

/* -------------------------------------------------------------------- cms */

/** Jobs an admin pinned to the top of the list, by the 24-hex site key. Lower position = higher up. */
export const pinnedJobs = pgTable("pinned_jobs", {
  jobKey: varchar("job_key", { length: 24 }).primaryKey(),
  position: integer("position").notNull(),
  // The title when pinned, so the admin list still names a job that has left the feed.
  title: text("title"),
  pinnedBy: text("pinned_by").notNull(),
  pinnedAt: ts("pinned_at").notNull().defaultNow(),
});

/** Site-wide announcements shown under the header while active and within their dates. */
export const banners = pgTable(
  "banners",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    text: text("text").notNull(),
    linkUrl: text("link_url"),
    linkLabel: text("link_label"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("banners_active_idx").on(t.active)],
);

/* ------------------------------------------------------- sandbox candidates */

export type ProfileSource = "apply" | "signup";
export type ApplicationStatus = "forwarded" | "failed";

/**
 * The basic profile of someone who applied or signed up, as first submitted (insert-only: an
 * unauthenticated form never overwrites it). Emails are stored lowercased. Never a CV.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    city: text("city"),
    consentAt: ts("consent_at").notNull(),
    source: text("source").$type<ProfileSource>().notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("profiles_source_check", sql`${t.source} in ('apply', 'signup')`)],
);

/**
 * One row per apply attempt. The id is the site_application_id sent to the CRM
 * (its idempotency key). No file name, no file hash, no file.
 */
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey(),
    jobKey: varchar("job_key", { length: 24 }).notNull(),
    jobTitle: text("job_title"),
    profileId: uuid("profile_id").references(() => profiles.id),
    // M2: what this submission said, kept on the row. The form is unauthenticated, so a later
    // submission with the same email never rewrites an earlier application (or the profile).
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    city: text("city"),
    consentAt: ts("consent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    status: text("status").$type<ApplicationStatus>().notNull(),
    crmApplicationId: text("crm_application_id"),
    crmCandidateId: text("crm_candidate_id"),
    // The CRM's error code or ours ("timeout", "unreachable", "not_configured"); never a message body.
    errorCode: text("error_code"),
  },
  (t) => [
    check("applications_status_check", sql`${t.status} in ('forwarded', 'failed')`),
    index("applications_created_idx").on(t.createdAt),
    index("applications_profile_idx").on(t.profileId),
  ],
);

/* ------------------------------------------------------------------ access */

export type Role = "editor" | "admin";

/** People allowed into the site while it is a preview (and into /admin after launch). Emails lowercased. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    // Google subject from the xhostd token; bound on first sign-in.
    sub: text("sub").unique(),
    name: text("name"),
    role: text("role").$type<Role>().notNull().default("editor"),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastLoginAt: ts("last_login_at"),
  },
  (t) => [check("users_role_check", sql`${t.role} in ('editor', 'admin')`)],
);

/** An admin's invitation, redeemed when that email first signs in. */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: text("role").$type<Role>().notNull(),
    invitedBy: text("invited_by").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [
    check("invites_role_check", sql`${t.role} in ('editor', 'admin')`),
    uniqueIndex("invites_open_email_idx").on(t.email).where(sql`accepted_at is null and revoked_at is null`),
  ],
);

/** Sign-ins that were refused, so an admin can approve them with one click. */
export const accessRequests = pgTable("access_requests", {
  email: text("email").primaryKey(),
  name: text("name"),
  attempts: integer("attempts").notNull().default(1),
  firstAt: ts("first_at").notNull().defaultNow(),
  lastAt: ts("last_at").notNull().defaultNow(),
});

/* ---------------------------------------------------------------- connect */

/** Inbound API keys issued at /admin/api. Only the sha256 of a key is kept (docs/connect-api.md §1). */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    prefix: varchar("prefix", { length: 8 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull(),
    scopes: text("scopes").array().notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at"),
    lastUsedAt: ts("last_used_at"),
    lastUsedIp: text("last_used_ip"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.hash)],
);

export type Peer = "admin" | "crm" | "site";

/** Outbound connections to the other SKEELZ apps; the key they issued to us, AES-256-GCM encrypted (§2). */
export const connections = pgTable(
  "connections",
  {
    peer: text("peer").$type<Peer>().primaryKey(),
    baseUrl: text("base_url").notNull(),
    keyCiphertext: text("key_ciphertext"),
    keyLast4: varchar("key_last4", { length: 4 }),
    enabled: boolean("enabled").notNull().default(true),
    updatedBy: text("updated_by").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    lastCheckAt: ts("last_check_at"),
    lastCheckOk: boolean("last_check_ok"),
    lastCheckDetail: text("last_check_detail"),
  },
  (t) => [check("connections_peer_check", sql`${t.peer} in ('admin', 'crm', 'site')`)],
);
