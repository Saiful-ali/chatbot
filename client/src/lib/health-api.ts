import { apiRequest } from "./query-Client";
import { 
  HealthCategory, 
  HealthAlert, 
  HealthFacility, 
  ChatResponse, 
  VoiceTranscription,
  LanguageSupport 
} from "@shared/schema";

// Health Categories API
export const healthCategoriesApi = {
  getAll: async (): Promise<HealthCategory[]> => {
    const response = await apiRequest("GET", "/api/health-categories");
    return response.json();
  },

  getEntries: async (categoryId: string): Promise<any[]> => {
    const response = await apiRequest("GET", `/api/health-entries/${categoryId}`);
    return response.json();
  }
};

// Health Alerts API
export const healthAlertsApi = {
  getAll: async (language = "en"): Promise<HealthAlert[]> => {
    const response = await apiRequest("GET", `/api/health-alerts?lang=${language}`);
    return response.json();
  },

  broadcast: async (phoneNumbers: string[], alert: {
    title: string;
    description: string;
    language: string;
    alertType: string;
  }) => {
    const response = await apiRequest("POST", "/api/broadcast-alert", {
      phoneNumbers,
      alert
    });
    return response.json();
  }
};

// Health Facilities API
export const healthFacilitiesApi = {
  getAll: async (type?: string): Promise<HealthFacility[]> => {
    const response = await apiRequest("GET", `/api/health-facilities${type ? `?type=${type}` : ""}`);
    return response.json();
  },

  getNearby: async (lat: number, lng: number, type?: string): Promise<HealthFacility[]> => {
    const response = await apiRequest("GET", `/api/health-facilities?lat=${lat}&lng=${lng}${type ? `&type=${type}` : ""}`);
    return response.json();
  },

  search: async (query: string, location?: { lat: number; lng: number }, type?: string, language = "en") => {
    const response = await apiRequest("POST", "/api/search-facilities", {
      query,
      location,
      type,
      language
    });
    return response.json();
  }
};

// Chat and AI API
export const chatApi = {
  enhancedSearch: async (data: {
    query: string;
    language?: string;
    userProfile?: any;
    symptoms?: string[];
  }): Promise<ChatResponse> => {
    const response = await apiRequest("POST", "/api/enhanced-search", data);
    return response.json();
  },

  getMessages: async (sessionId: string) => {
    const response = await apiRequest("GET", `/api/chat-messages/${sessionId}`);
    return response.json();
  },

  saveMessage: async (messageData: any) => {
    const response = await apiRequest("POST", "/api/chat-messages", messageData);
    return response.json();
  }
};

// Voice and Translation API
export const voiceApi = {
  transcribe: async (audioFile: File, language = "en"): Promise<VoiceTranscription> => {
    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("language", language);

    const response = await fetch("/api/transcribe-voice", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  translate: async (text: string, targetLanguage: string) => {
    const response = await apiRequest("POST", "/api/translate", {
      text,
      targetLanguage
    });
    return response.json();
  }
};

// WhatsApp and SMS API
export const messagingApi = {
  sendSMS: async (to: string, message: string, language = "en") => {
    const response = await apiRequest("POST", "/api/send-sms", {
      to,
      message,
      language
    });
    return response.json();
  },

  sendWhatsApp: async (to: string, message: string, language = "en", mediaUrl?: string) => {
    const response = await apiRequest("POST", "/api/send-whatsapp", {
      to,
      message,
      language,
      mediaUrl
    });
    return response.json();
  }
};

// User Authentication API
export const authApi = {
  register: async (userData: {
    phoneNumber: string;
    name?: string;
    preferredLanguage?: string;
  }) => {
    const response = await apiRequest("POST", "/api/auth/register", userData);
    return response.json();
  },

  login: async (phoneNumber: string) => {
    const response = await apiRequest("POST", "/api/auth/login", {
      phoneNumber
    });
    return response.json();
  }
};

// System API
export const systemApi = {
  getSupportedLanguages: async (): Promise<LanguageSupport[]> => {
    const response = await apiRequest("GET", "/api/supported-languages");
    return response.json();
  },

  getEmergencyContacts: async () => {
    const response = await apiRequest("GET", "/api/emergency-contacts");
    return response.json();
  },

  getHealthStatus: async () => {
    const response = await apiRequest("GET", "/api/health");
    return response.json();
  }
};

// Utility functions for health data processing
export const healthUtils = {
  assessRisk: (symptoms: string[]): { level: string; confidence: number } => {
    if (!symptoms || symptoms.length === 0) {
      return { level: "LOW", confidence: 0.3 };
    }

    const emergencyKeywords = [
      "chest pain", "difficulty breathing", "severe bleeding", "unconscious",
      "heart attack", "stroke", "seizure", "severe allergic reaction"
    ];

    const highRiskKeywords = [
      "high fever", "severe headache", "persistent vomiting", 
      "difficulty swallowing", "severe abdominal pain"
    ];

    const mediumRiskKeywords = [
      "fever", "headache", "nausea", "fatigue", "dizziness", "cough"
    ];

    const symptomText = symptoms.join(" ").toLowerCase();

    if (emergencyKeywords.some(keyword => symptomText.includes(keyword))) {
      return { level: "CRITICAL", confidence: 0.9 };
    }

    if (highRiskKeywords.some(keyword => symptomText.includes(keyword))) {
      return { level: "HIGH", confidence: 0.8 };
    }

    if (mediumRiskKeywords.some(keyword => symptomText.includes(keyword))) {
      return { level: "MEDIUM", confidence: 0.7 };
    }

    return { level: "LOW", confidence: 0.5 };
  },

  formatPhoneNumber: (phone: string): string => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return `+${digitsOnly}`;
    }
    
    return phone;
  },

  validatePhoneNumber: (phone: string): boolean => {
    // Basic validation for Indian phone numbers
    const indianPhoneRegex = /^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/;
    return indianPhoneRegex.test(phone);
  },

  getLanguageDirection: (languageCode: string): "ltr" | "rtl" => {
    // All supported languages use left-to-right text direction
    return "ltr";
  },

  getLanguageFlag: (languageCode: string): string => {
    // All supported languages use Indian flag since they're Indian languages
    return "🇮🇳";
  }
};

// Error handling utility
export class HealthApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiResponse?: any
  ) {
    super(message);
    this.name = "HealthApiError";
  }
}

// Request wrapper with error handling
export async function safeApiRequest<T>(
  apiCall: () => Promise<T>,
  fallbackData?: T
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await apiCall();
    return { data, error: null };
  } catch (error) {
    console.error("API request failed:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "An unexpected error occurred";
    
    return { 
      data: fallbackData || null, 
      error: errorMessage 
    };
  }
}
