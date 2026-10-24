import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const channelsTable = pgTable("channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  country: text("country").notNull(),
  region: text("region").notNull(),
  languages: jsonb("languages").notNull().$type<string[]>().default([]),
  categories: jsonb("categories").notNull().$type<string[]>().default([]),
  streamUrl: text("stream_url"),
  streamUrls: jsonb("stream_urls").notNull().$type<string[]>().default([]),
  quality: text("quality"),
  isOnline: boolean("is_online").notNull().default(false),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("channels_is_online_idx").on(t.isOnline),
  index("channels_country_idx").on(t.country),
  index("channels_quality_idx").on(t.quality),
  index("channels_name_idx").on(t.name),
  index("channels_online_country_idx").on(t.isOnline, t.country),
  index("channels_online_name_idx").on(t.isOnline, t.name),
]);

export const channelHealthTable = pgTable("channel_health", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  isOnline: boolean("is_online").notNull().default(false),
  streamUrl: text("stream_url"),
  quality: text("quality"),
  responseTimeMs: text("response_time_ms"),
  errorMessage: text("error_message"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channelsTable).omit({ createdAt: true, updatedAt: true });
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channelsTable.$inferSelect;

export const insertChannelHealthSchema = createInsertSchema(channelHealthTable);
export type InsertChannelHealth = z.infer<typeof insertChannelHealthSchema>;
export type ChannelHealth = typeof channelHealthTable.$inferSelect;
