import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSupport } from "@shared/schema";

interface LanguageSelectorProps {
  currentLanguage: string;
  supportedLanguages: LanguageSupport[];
  onLanguageSelect: (languageCode: string) => void;
  onClose: () => void;
}

export default function LanguageSelector({ 
  currentLanguage, 
  supportedLanguages, 
  onLanguageSelect, 
  onClose 
}: LanguageSelectorProps) {
  
  const handleLanguageSelect = (languageCode: string) => {
    onLanguageSelect(languageCode);
    onClose();
  };

  const handleSavePreference = () => {
    // Save to localStorage - already handled by parent component
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      data-testid="language-modal-overlay"
    >
      <Card 
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle data-testid="language-modal-title">
            Select Your Language
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {supportedLanguages.map((language) => {
            const isSelected = currentLanguage === language.code;
            
            return (
              <button
                key={language.code}
                className="w-full flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => handleLanguageSelect(language.code)}
                data-testid={`language-option-${language.code}`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl" role="img" aria-label={`${language.name} flag`}>
                    {language.flag}
                  </span>
                  <div className="text-left">
                    <p className="font-medium">{language.name}</p>
                    <p className="text-sm text-muted-foreground">{language.nativeName}</p>
                  </div>
                </div>
                
                {isSelected && (
                  <i 
                    className="fas fa-check text-primary"
                    data-testid={`language-selected-${language.code}`}
                  ></i>
                )}
              </button>
            );
          })}
          
          <div className="flex space-x-2 mt-6">
            <Button 
              className="flex-1"
              onClick={handleSavePreference}
              data-testid="save-language-preference"
            >
              Save Preference
            </Button>
            
            <Button 
              variant="outline"
              onClick={onClose}
              data-testid="cancel-language-selection"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
