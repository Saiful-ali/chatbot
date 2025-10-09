import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { HealthCategory, HealthAlert } from "@shared/schema";

interface SidebarProps {
  currentLanguage: string;
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string) => void;
  onEmergencyCall: () => void;
}

export default function Sidebar({ 
  currentLanguage, 
  selectedCategory, 
  onCategorySelect, 
  onEmergencyCall 
}: SidebarProps) {
  
  // Fetch health categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<HealthCategory[]>({
    queryKey: ["/api/health-categories"],
  });

  // Fetch health alerts
  const { data: alerts = [] } = useQuery<HealthAlert[]>({
    queryKey: ["/api/health-alerts", currentLanguage],
  });

  const latestAlert = alerts[0];

  const getTranslatedText = (text: string, translations?: Record<string, string> | null) => {
    if (!translations || currentLanguage === "en") return text;
    return translations[currentLanguage] || text;
  };

  return (
    <aside className="w-80 bg-card border-r border-border hidden lg:block" data-testid="sidebar">
      <div className="p-4 space-y-4">
        
        {/* Emergency Contact */}
        <div className="emergency-button text-center p-4 rounded-lg text-white">
          <i className="fas fa-phone-alt text-2xl mb-2"></i>
          <h3 className="font-bold text-lg">Emergency</h3>
          <p className="text-sm mb-3">Call 108 for immediate help</p>
          <button 
            className="bg-white text-red-600 px-4 py-2 rounded-md font-bold hover:bg-gray-100 transition-colors"
            onClick={onEmergencyCall}
            data-testid="emergency-button-sidebar"
          >
            <i className="fas fa-phone mr-2"></i>Call Now
          </button>
        </div>

        {/* Health Alerts */}
        {latestAlert && (
          <Card className="bg-accent text-accent-foreground p-4">
            <h3 className="font-bold text-lg mb-2">
              <i className="fas fa-bell mr-2"></i>Latest Health Alert
            </h3>
            <div className="bg-accent-foreground/10 p-3 rounded-md">
              <p className="text-sm font-medium" data-testid="alert-title">
                {getTranslatedText(latestAlert.title, latestAlert.titleTranslations || undefined)}
              </p>
              <p className="text-xs mt-1 opacity-90" data-testid="alert-description">
                {getTranslatedText(latestAlert.description, latestAlert.descriptionTranslations || undefined)}
              </p>
              <p className="text-xs mt-2 font-medium">
                {latestAlert.createdAt ? new Date(latestAlert.createdAt).toLocaleString() : "Recently"}
              </p>
            </div>
          </Card>
        )}

        {/* Health Categories */}
        <div className="space-y-2">
          <h3 className="font-bold text-lg mb-3">Health Categories</h3>
          
          {categoriesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            categories.map((category) => {
              const isSelected = selectedCategory === category.id;
              const categoryName = getTranslatedText(category.name, category.nameTranslations || undefined);
              
              return (
                <button
                  key={category.id}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left health-card ${
                    isSelected 
                      ? "bg-accent text-accent-foreground" 
                      : "bg-muted hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => onCategorySelect(category.id)}
                  data-testid={`category-${category.id}`}
                >
                  <i className={`fas ${getCategoryIcon(category.type)} text-xl text-accent`}></i>
                  <div>
                    <p className="font-medium">{categoryName}</p>
                    <p className="text-xs text-muted-foreground">{category.count} entries</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}

function getCategoryIcon(type: string): string {
  const iconMap: Record<string, string> = {
    diseases: "fa-virus",
    disasters: "fa-exclamation-triangle",
    vaccinations: "fa-syringe",
    symptoms: "fa-heartbeat",
    "health-facilities": "fa-hospital",
    "health-interventions": "fa-hand-holding-medical"
  };
  return iconMap[type] || "fa-info-circle";
}
