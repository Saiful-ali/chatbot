import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import ChatInterface from "@/components/chat-interface";
import LanguageSelector from "@/components/language-selector";
import { useOffline } from "@/hooks/use-offline";
import { LanguageSupport } from "@shared/schema";

export default function Home() {
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [user, setUser] = useState({
    name: "Guest User",
    phoneNumber: "",
    authenticated: false
  });

  const { isOffline } = useOffline();

  // Fetch supported languages
  const { data: supportedLanguages = [] } = useQuery<LanguageSupport[]>({
    queryKey: ["/api/supported-languages"],
  });

  // Generate session ID for chat
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Load user preferences from localStorage
    const savedLanguage = localStorage.getItem("preferred_language");
    const savedUser = localStorage.getItem("user_data");

    if (savedLanguage) {
      setCurrentLanguage(savedLanguage);
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Failed to parse saved user data:", error);
      }
    }
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    setCurrentLanguage(languageCode);
    localStorage.setItem("preferred_language", languageCode);
  };

  const handleEmergencyCall = () => {
    if (confirm("Do you want to call emergency services (108)?")) {
      window.location.href = "tel:108";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="https://images.unsplash.com/photo-1551218808-94e220e084d2?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60" 
                alt="Government of Odisha Logo" 
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h1 className="text-lg font-bold" data-testid="app-title">
                  AI Health Assistant
                </h1>
                <p className="text-xs opacity-90">Government of Odisha</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Language Selector */}
              <select 
                className="bg-primary-foreground text-primary px-3 py-1 rounded-md text-sm font-medium border-2 border-transparent focus:border-accent"
                value={currentLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                data-testid="language-selector"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              
              {/* User Profile */}
              <div className="flex items-center space-x-2">
                <img 
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40" 
                  alt="User Avatar" 
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium" data-testid="user-name">
                  {user.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Offline Status Banner */}
      {isOffline && (
        <div className="offline-indicator text-white py-2 px-4 text-center text-sm font-medium" data-testid="offline-banner">
          <i className="fas fa-wifi-slash mr-2"></i>
          You're offline. Using cached data.
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex">
        <Sidebar 
          currentLanguage={currentLanguage}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          onEmergencyCall={handleEmergencyCall}
        />
        
        <ChatInterface 
          currentLanguage={currentLanguage}
          sessionId={sessionId}
          user={user}
          selectedCategory={selectedCategory}
        />
      </div>

      {/* Mobile Emergency Button */}
      <button 
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 emergency-button rounded-full text-white shadow-lg flex items-center justify-center"
        onClick={handleEmergencyCall}
        data-testid="emergency-button-mobile"
      >
        <i className="fas fa-phone-alt text-lg"></i>
      </button>

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <LanguageSelector
          currentLanguage={currentLanguage}
          supportedLanguages={supportedLanguages}
          onLanguageSelect={handleLanguageChange}
          onClose={() => setShowLanguageModal(false)}
        />
      )}
    </div>
  );
}
