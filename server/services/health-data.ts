import { storage } from '../storage';
import { HealthEntry, HealthAlert, HealthFacility } from '@shared/schema';

export interface HealthDataService {
  searchHealthInformation(query: string, language: string): Promise<HealthEntry[]>;
  getHealthRecommendations(symptoms: string[], language: string): Promise<{
    recommendations: string[];
    riskLevel: string;
    emergencyRequired: boolean;
  }>;
  getNearbyFacilities(lat: number, lng: number, type?: string): Promise<HealthFacility[]>;
  getLatestAlerts(language: string): Promise<HealthAlert[]>;
}

class HealthDataServiceImpl implements HealthDataService {

  async searchHealthInformation(query: string, language: string): Promise<HealthEntry[]> {
    try {
      const results = await storage.searchHealthEntries(query);
      return results.slice(0, 10); // Limit results
    } catch (error) {
      console.error("Error searching health information:", error);
      return [];
    }
  }

  async getHealthRecommendations(symptoms: string[], language: string): Promise<{
    recommendations: string[];
    riskLevel: string;
    emergencyRequired: boolean;
  }> {
    try {
      const emergencySymptoms = [
        'chest pain', 'difficulty breathing', 'severe bleeding', 'unconscious',
        'heart attack', 'stroke', 'severe allergic reaction'
      ];
      
      const highRiskSymptoms = [
        'high fever', 'severe headache', 'persistent vomiting', 'difficulty swallowing'
      ];

      const lowercaseSymptoms = symptoms.map(s => s.toLowerCase());
      const hasEmergencySymptom = emergencySymptoms.some(es => 
        lowercaseSymptoms.some(s => s.includes(es))
      );
      
      const hasHighRiskSymptom = highRiskSymptoms.some(hrs => 
        lowercaseSymptoms.some(s => s.includes(hrs))
      );

      let riskLevel = "LOW";
      let emergencyRequired = false;
      let recommendations: string[] = [];

      if (hasEmergencySymptom) {
        riskLevel = "CRITICAL";
        emergencyRequired = true;
        recommendations = [
          "Call 108 immediately for emergency services",
          "Go to the nearest hospital emergency room",
          "Do not delay seeking immediate medical attention"
        ];
      } else if (hasHighRiskSymptom) {
        riskLevel = "HIGH";
        recommendations = [
          "Consult a doctor within 24 hours",
          "Monitor symptoms closely",
          "Prepare to seek emergency care if symptoms worsen"
        ];
      } else if (symptoms.length > 0) {
        riskLevel = "MEDIUM";
        recommendations = [
          "Rest and stay hydrated",
          "Monitor symptoms for 24-48 hours",
          "Consult a healthcare provider if symptoms persist or worsen",
          "Take over-the-counter medication as appropriate"
        ];
      } else {
        recommendations = [
          "Maintain good hygiene practices",
          "Eat a balanced diet",
          "Get regular exercise",
          "Schedule routine health checkups"
        ];
      }

      return {
        recommendations,
        riskLevel,
        emergencyRequired
      };
    } catch (error) {
      console.error("Error getting health recommendations:", error);
      return {
        recommendations: ["Please consult a healthcare professional for proper advice"],
        riskLevel: "UNKNOWN",
        emergencyRequired: false
      };
    }
  }

  async getNearbyFacilities(lat: number, lng: number, type?: string): Promise<HealthFacility[]> {
    try {
      const facilities = await storage.getHealthFacilities(); // get all facilities

      // Calculate distance and filter by radius (25 km)
      const facilitiesWithDistance = facilities
        .filter(f => f.coordinates)
        .map(f => ({
          ...f,
          distance: this.calculateDistance(lat, lng, f.coordinates!.lat, f.coordinates!.lng)
        }))
        .filter(f => f.distance <= 25);

      // Filter by type if provided
      const filtered = type
        ? facilitiesWithDistance.filter(f => f.type === type)
        : facilitiesWithDistance;

      // Sort by distance and take top 10
      return filtered.sort((a, b) => a.distance - b.distance).slice(0, 10);
    } catch (error) {
      console.error("Error getting nearby facilities:", error);
      return [];
    }
  }

  async getLatestAlerts(language: string): Promise<HealthAlert[]> {
    try {
      const alerts = await storage.getActiveHealthAlerts();
      return alerts.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1;
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      }).slice(0, 5);
    } catch (error) {
      console.error("Error getting latest alerts:", error);
      return [];
    }
  }

  // Private helper to calculate distance between two coordinates
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const healthDataService = new HealthDataServiceImpl();

// Emergency contact info
export const EMERGENCY_CONTACTS = {
  emergency: "108",
  police: "100",
  fire: "101",
  ambulance: "108",
  women_helpline: "1091",
  child_helpline: "1098"
};

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇮🇳", supported: true },
  { code: "hi", name: "Hindi", nativeName: "हिंदी", flag: "🇮🇳", supported: true },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", flag: "🇮🇳", supported: true },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳", supported: true },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", supported: true },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", supported: true }
];
