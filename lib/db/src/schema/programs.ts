import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { channelsTable } from "./channels";

export const channelProgramsTable = pgTable("channel_programs", {
  id:        text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  description: text("description"),
  start:     timestamp("start", { withTimezone: true }).notNull(),
  end:       timestamp("end", { withTimezone: true }).notNull(),
  category:  text("category"),
  episode:   text("episode"),
  icon:      text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_programs_channel_start").on(t.channelId, t.start),
]);

export type ChannelProgram = typeof channelProgramsTable.$inferSelect;
export type InsertChannelProgram = typeof channelProgramsTable.$inferInsert;
