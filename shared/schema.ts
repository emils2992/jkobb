import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (Discord users)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Discord user ID
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  userId: true,
  username: true,
  avatarUrl: true,
});

// Attributes table (player attributes)
export const attributes = pgTable("attributes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Discord user ID
  name: text("name").notNull(), // e.g., speed, shooting, etc.
  value: integer("value").notNull(),
  weeklyValue: integer("weekly_value").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAttributeSchema = createInsertSchema(attributes).pick({
  userId: true,
  name: true,
  value: true,
  weeklyValue: true,
});

// Tickets table
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().unique(), // Discord channel ID for the ticket
  userId: text("user_id").notNull(), // Discord user ID who opened the ticket
  status: text("status").notNull().default("open"), // open, pending, closed
  type: text("type").notNull().default("attribute"), // attribute, training
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const insertTicketSchema = createInsertSchema(tickets).pick({
  ticketId: true,
  userId: true,
  status: true,
  type: true,
});

// Ticket attribute requests
export const attributeRequests = pgTable("attribute_requests", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull(), // References tickets.ticketId
  attributeName: text("attribute_name").notNull(),
  valueRequested: integer("value_requested").notNull(),
  approved: boolean("approved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttributeRequestSchema = createInsertSchema(attributeRequests).pick({
  ticketId: true,
  attributeName: true,
  valueRequested: true,
  approved: true,
});

// Training sessions
export const trainingSessions = pgTable("training_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Discord user ID
  ticketId: text("ticket_id"), // Optional reference to a ticket
  duration: integer("duration").notNull(), // in minutes
  attributesGained: integer("attributes_gained").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainingSessionSchema = createInsertSchema(trainingSessions).pick({
  userId: true,
  ticketId: true,
  duration: true,
  attributesGained: true,
});

// Server configuration
export const serverConfig = pgTable("server_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(), // Discord guild/server ID
  fixLogChannelId: text("fix_log_channel_id"), // Channel ID for fix logs
  trainingChannelId: text("training_channel_id"), // Channel ID for training logs
  lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServerConfigSchema = createInsertSchema(serverConfig).pick({
  guildId: true,
  fixLogChannelId: true,
  trainingChannelId: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Attribute = typeof attributes.$inferSelect;
export type InsertAttribute = z.infer<typeof insertAttributeSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type AttributeRequest = typeof attributeRequests.$inferSelect;
export type InsertAttributeRequest = z.infer<typeof insertAttributeRequestSchema>;

export type TrainingSession = typeof trainingSessions.$inferSelect;
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;

export type ServerConfig = typeof serverConfig.$inferSelect;
export type InsertServerConfig = z.infer<typeof insertServerConfigSchema>;
