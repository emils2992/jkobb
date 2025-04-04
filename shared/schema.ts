import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { createHash } from "crypto";

// Users table (Discord users)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Discord user ID
  username: text("username").notNull(), // Discord kullanıcı adı
  displayName: text("display_name"), // Discord sunucusundaki görünen isim (nickname)
  avatarUrl: text("avatar_url"), // Profil fotoğrafı URL'si
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  userId: true,
  username: true,
  displayName: true,
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
  source: text("source").notNull().default('manual'), // manual, ticket, training
});

export const insertAttributeSchema = createInsertSchema(attributes).pick({
  userId: true,
  name: true,
  value: true,
  weeklyValue: true,
  source: true,
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
  closedBy: text("closed_by"), // Discord user ID who closed the ticket
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
  attributeName: text("attribute_name").notNull(), // The attribute being trained (e.g., 'kısa pas')
  duration: integer("duration").notNull(), // in minutes
  intensity: integer("intensity").default(1).notNull(), // Training intensity (1-5)
  attributesGained: integer("attributes_gained").notNull(), // Points gained from this training
  source: text("source").default("training").notNull(), // 'training' or 'ticket'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  messageId: text("message_id"), // Discord message ID for reference
  channelId: text("channel_id"), // Discord channel ID where the training was posted
});

export const insertTrainingSessionSchema = createInsertSchema(trainingSessions).pick({
  userId: true,
  ticketId: true,
  attributeName: true,
  duration: true,
  intensity: true,
  attributesGained: true,
  source: true,
  messageId: true,
  channelId: true,
});

// Server configuration
export const serverConfig = pgTable("server_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(), // Discord guild/server ID
  fixLogChannelId: text("fix_log_channel_id"), // Channel ID for fix logs
  trainingChannelId: text("training_channel_id"), // Channel ID for training logs (ana kanal)
  trainingChannelId1: text("training_channel_id_1"), // Kanal 1 - 1 saat
  trainingChannelId2: text("training_channel_id_2"), // Kanal 2 - 2 saat
  trainingChannelId3: text("training_channel_id_3"), // Kanal 3 - 3 saat
  trainingChannelId4: text("training_channel_id_4"), // Kanal 4 - 4 saat
  trainingChannelId5: text("training_channel_id_5"), // Kanal 5 - 5 saat
  staffRoleId: text("staff_role_id"), // Staff role ID
  lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServerConfigSchema = createInsertSchema(serverConfig).pick({
  guildId: true,
  fixLogChannelId: true,
  trainingChannelId: true,
  trainingChannelId1: true,
  trainingChannelId2: true,
  trainingChannelId3: true,
  trainingChannelId4: true,
  trainingChannelId5: true,
  staffRoleId: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Attribute = typeof attributes.$inferSelect;
export type InsertAttribute = z.infer<typeof insertAttributeSchema>;

export type Ticket = typeof tickets.$inferSelect & { closedBy?: string | null };
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type AttributeRequest = typeof attributeRequests.$inferSelect;
export type InsertAttributeRequest = z.infer<typeof insertAttributeRequestSchema>;

export type TrainingSession = typeof trainingSessions.$inferSelect;
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;

export type ServerConfig = typeof serverConfig.$inferSelect;
export type InsertServerConfig = z.infer<typeof insertServerConfigSchema>;

// Admins table for web admin panel
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").default("admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

export const insertAdminSchema = createInsertSchema(admins).pick({
  username: true,
  passwordHash: true,
  displayName: true,
  role: true,
}).extend({
  // Bu, frontend'den password alır ve schema içinde hash'e çevirir
  password: z.string().min(6),
});

// Chat messages for admin panel
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(), // References admins.id
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  adminId: true,
  content: true,
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = Omit<z.infer<typeof insertAdminSchema>, "password"> & { passwordHash: string };

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
