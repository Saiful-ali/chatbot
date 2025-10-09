// server/storage.ts
import { db } from "./db"; // your Drizzle ORM instance
import { 
  users, healthCategories, healthEntries, healthAlerts, chatMessages, healthFacilities, doctors, faqs,
  User, InsertUser,
  HealthCategory, InsertHealthCategory,
  HealthEntry, InsertHealthEntry,
  HealthAlert, InsertHealthAlert,
  ChatMessage, InsertChatMessage,
  HealthFacility, InsertHealthFacility,
  Doctor, InsertDoctor,
  Faq, InsertFaq
} from "../shared/schema";
import { IStorage } from "./storage.interface";

export const storage: IStorage = {
  // --- Users ---
  async getUser(id: string) {
    return db.select().from(users).where(users.id.eq(id)).get() as Promise<User | undefined>;
  },

  async getUserByPhone(phoneNumber: string) {
    return db.select().from(users).where(users.phoneNumber.eq(phoneNumber)).get() as Promise<User | undefined>;
  },

  async createUser(user: InsertUser) {
    const result = await db.insert(users).values(user).returning();
    return result[0] as User;
  },

  async updateUser(id: string, updates: Partial<User>) {
    const result = await db.update(users).set(updates).where(users.id.eq(id)).returning();
    return result[0] as User | undefined;
  },

  // --- Health Categories ---
  async getHealthCategories() {
    return db.select().from(healthCategories).all() as Promise<HealthCategory[]>;
  },

  async getHealthCategory(id: string) {
    return db.select().from(healthCategories).where(healthCategories.id.eq(id)).get() as Promise<HealthCategory | undefined>;
  },

  async createHealthCategory(category: InsertHealthCategory) {
    const result = await db.insert(healthCategories).values(category).returning();
    return result[0] as HealthCategory;
  },

  // --- Health Entries ---
  async getHealthEntries(categoryId?: string) {
    let query = db.select().from(healthEntries);
    if (categoryId) query = query.where(healthEntries.categoryId.eq(categoryId));
    return query.all() as Promise<HealthEntry[]>;
  },

  async getHealthEntry(id: string) {
    return db.select().from(healthEntries).where(healthEntries.id.eq(id)).get() as Promise<HealthEntry | undefined>;
  },

  async createHealthEntry(entry: InsertHealthEntry) {
    const result = await db.insert(healthEntries).values(entry).returning();
    return result[0] as HealthEntry;
  },

  async searchHealthEntries(query: string, language?: string) {
    const entries = await db.select().from(healthEntries).all() as HealthEntry[];
    const q = query.toLowerCase();
    return entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q)
    );
  },

  // --- Health Alerts ---
  async getHealthAlerts() {
    return db.select().from(healthAlerts).all() as Promise<HealthAlert[]>;
  },

  async getActiveHealthAlerts() {
    return db.select().from(healthAlerts).where(healthAlerts.isActive.eq(true)).all() as Promise<HealthAlert[]>;
  },

  async createHealthAlert(alert: InsertHealthAlert) {
    const result = await db.insert(healthAlerts).values(alert).returning();
    return result[0] as HealthAlert;
  },

  // --- Chat Messages ---
  async getChatMessages(sessionId: string) {
    return db.select().from(chatMessages).where(chatMessages.sessionId.eq(sessionId)).all() as Promise<ChatMessage[]>;
  },

  async createChatMessage(message: InsertChatMessage) {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0] as ChatMessage;
  },

  // --- Health Facilities ---
  async getHealthFacilities(type?: string) {
    let query = db.select().from(healthFacilities);
    if (type) query = query.where(healthFacilities.type.eq(type));
    return query.all() as Promise<HealthFacility[]>;
  },

  async getNearbyHealthFacilities(lat: number, lng: number, radius = 10) {
    const allFacilities = await db.select().from(healthFacilities).all() as HealthFacility[];
    // Simple distance filter (approximate)
    return allFacilities.filter(f => {
      const coords = f.coordinates;
      if (!coords) return false;
      const dist = Math.sqrt((coords.lat - lat) ** 2 + (coords.lng - lng) ** 2);
      return dist <= radius;
    });
  },

  async createHealthFacility(facility: InsertHealthFacility) {
    const result = await db.insert(healthFacilities).values(facility).returning();
    return result[0] as HealthFacility;
  },

  // --- Doctors ---
  async getDoctors() {
    return db.select().from(doctors).all() as Promise<Doctor[]>;
  },

  async getDoctor(id: string) {
    return db.select().from(doctors).where(doctors.id.eq(id)).get() as Promise<Doctor | undefined>;
  },

  async createDoctor(doctor: InsertDoctor) {
    const result = await db.insert(doctors).values(doctor).returning();
    return result[0] as Doctor;
  },

  // --- FAQs ---
  async getFaqs(language?: string) {
    let query = db.select().from(faqs);
    if (language) query = query.where(faqs.language.eq(language));
    return query.all() as Promise<Faq[]>;
  },

  async getFaq(id: string) {
    return db.select().from(faqs).where(faqs.id.eq(id)).get() as Promise<Faq | undefined>;
  },

  async createFaq(faq: InsertFaq) {
    const result = await db.insert(faqs).values(faq).returning();
    return result[0] as Faq;
  },
};
