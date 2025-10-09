// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// -------------------------------
// Users
// -------------------------------
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull().unique(),
  name: text("name"),
  preferredLanguage: text("preferred_language").default("en"),
  isAuthenticated: boolean("is_authenticated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// -------------------------------
// Health Categories
// -------------------------------
export const healthCategories = pgTable("health_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameTranslations: jsonb("name_translations").$type<Record<string, string>>(),
  type: text("type").notNull(),
  description: text("description"),
  descriptionTranslations: jsonb("description_translations").$type<Record<string, string>>(),
  count: integer("count").default(0),
});

export const insertHealthCategorySchema = createInsertSchema(healthCategories).omit({ id: true });
export type HealthCategory = typeof healthCategories.$inferSelect;
export type InsertHealthCategory = z.infer<typeof insertHealthCategorySchema>;

// -------------------------------
// Health Entries
// -------------------------------
export const healthEntries = pgTable("health_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => healthCategories.id),
  title: text("title").notNull(),
  titleTranslations: jsonb("title_translations").$type<Record<string, string>>(),
  content: text("content").notNull(),
  contentTranslations: jsonb("content_translations").$type<Record<string, string>>(),
  symptoms: jsonb("symptoms").$type<string[]>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  riskLevel: text("risk_level"),
  emergencyContact: text("emergency_contact"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHealthEntrySchema = createInsertSchema(healthEntries).omit({ id: true, createdAt: true });
export type HealthEntry = typeof healthEntries.$inferSelect;
export type InsertHealthEntry = z.infer<typeof insertHealthEntrySchema>;

// -------------------------------
// Health Alerts
// -------------------------------
export const healthAlerts = pgTable("health_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  titleTranslations: jsonb("title_translations").$type<Record<string, string>>(),
  description: text("description").notNull(),
  descriptionTranslations: jsonb("description_translations").$type<Record<string, string>>(),
  alertType: text("alert_type").notNull(),
  priority: text("priority").default("medium"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHealthAlertSchema = createInsertSchema(healthAlerts).omit({ id: true, createdAt: true });
export type HealthAlert = typeof healthAlerts.$inferSelect;
export type InsertHealthAlert = z.infer<typeof insertHealthAlertSchema>;

// -------------------------------
// Chat Messages
// -------------------------------
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id").notNull(),
  message: text("message").notNull(),
  messageType: text("message_type").notNull(),
  language: text("language").default("en"),
  isVoiceInput: boolean("is_voice_input").default(false),
  aiResponse: text("ai_response"),
  riskAssessment: jsonb("risk_assessment").$type<{
    level: string;
    confidence: number;
    recommendations: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// -------------------------------
// Health Facilities
// -------------------------------
export const healthFacilities = pgTable("health_facilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameTranslations: jsonb("name_translations").$type<Record<string, string>>(),
  type: text("type").notNull(),
  address: text("address").notNull(),
  addressTranslations: jsonb("address_translations").$type<Record<string, string>>(),
  phone: text("phone"),
  coordinates: jsonb("coordinates").$type<{ lat: number; lng: number }>(),
  services: jsonb("services").$type<string[]>(),
  emergencyServices: boolean("emergency_services").default(false),
  is24x7: boolean("is_24x7").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHealthFacilitySchema = createInsertSchema(healthFacilities).omit({ id: true, createdAt: true });
export type HealthFacility = typeof healthFacilities.$inferSelect;
export type InsertHealthFacility = z.infer<typeof insertHealthFacilitySchema>;

// -------------------------------
// Doctors
// -------------------------------
export const doctors = pgTable("doctors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameTranslations: jsonb("name_translations").$type<Record<string, string>>(),
  specialization: text("specialization").notNull(),
  specializationTranslations: jsonb("specialization_translations").$type<Record<string, string>>(),
  phone: text("phone"),
  email: text("email"),
  experienceYears: integer("experience_years").default(0),
  languages: jsonb("languages").$type<string[]>(),
  consultationModes: jsonb("consultation_modes").$type<string[]>(),
  facilityId: varchar("facility_id").references(() => healthFacilities.id),
  availableTimings: jsonb("available_timings").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDoctorSchema = createInsertSchema(doctors).omit({ id: true, createdAt: true });
export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
// -------------------------------
// FAQs
// -------------------------------
export const faqs = pgTable("faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  questionTranslations: jsonb("question_translations").$type<Record<string, string>>(),
  answer: text("answer").notNull(),
  answerTranslations: jsonb("answer_translations").$type<Record<string, string>>(),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFaqSchema = createInsertSchema(faqs).omit({ id: true, createdAt: true });

export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;
