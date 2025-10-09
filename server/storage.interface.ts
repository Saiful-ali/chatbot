import { 
  User, InsertUser,
  HealthCategory, InsertHealthCategory,
  HealthEntry, InsertHealthEntry,
  HealthAlert, InsertHealthAlert,
  ChatMessage, InsertChatMessage,
  HealthFacility, InsertHealthFacility,
  Doctor, InsertDoctor
} from "@shared/schema";

export interface IStorage {
  // --- Users ---
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // --- Health Categories ---
  getHealthCategories(): Promise<HealthCategory[]>;
  getHealthCategory(id: string): Promise<HealthCategory | undefined>;
  createHealthCategory(category: InsertHealthCategory): Promise<HealthCategory>;

  // --- Health Entries ---
  getHealthEntries(categoryId?: string): Promise<HealthEntry[]>;
  getHealthEntry(id: string): Promise<HealthEntry | undefined>;
  createHealthEntry(entry: InsertHealthEntry): Promise<HealthEntry>;
  searchHealthEntries(query: string, language?: string): Promise<HealthEntry[]>;

  // --- Health Alerts ---
  getHealthAlerts(language?: string): Promise<HealthAlert[]>;
  getActiveHealthAlerts(language?: string): Promise<HealthAlert[]>;
  createHealthAlert(alert: InsertHealthAlert): Promise<HealthAlert>;

  // --- Chat Messages ---
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // --- Health Facilities ---
  getHealthFacilities(type?: string): Promise<HealthFacility[]>;
  getNearbyHealthFacilities(lat: number, lng: number, radius?: number): Promise<HealthFacility[]>;
  createHealthFacility(facility: InsertHealthFacility): Promise<HealthFacility>;

  // --- Doctors ---
  getDoctors(): Promise<Doctor[]>;
  getDoctor(id: string): Promise<Doctor | undefined>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  updateDoctor(id: string, updates: Partial<Doctor>): Promise<Doctor | undefined>;
  deleteDoctor(id: string): Promise<void>;
  searchDoctors(specialization?: string, language?: string): Promise<Doctor[]>;
}
