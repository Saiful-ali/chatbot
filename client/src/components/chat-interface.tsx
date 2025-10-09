import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import VoiceInput from "@/components/voice-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/query-Client";
import { ChatMessage, ChatResponse } from "@shared/schema";

interface ChatInterfaceProps {
  currentLanguage: string;
  sessionId: string;
  user: {
    name: string;
    phoneNumber: string;
    authenticated: boolean;
  };
  selectedCategory: string | null;
}

interface Message {
  id: string;
  message: string;
  messageType: "user" | "ai" | "system";
  language: string;
  isVoiceInput?: boolean;
  aiResponse?: string;
  riskAssessment?: {
    level: string;
    confidence: number;
    recommendations: string[];
  };
  createdAt: Date;
}

export default function ChatInterface({ 
  currentLanguage, 
  sessionId, 
  user, 
  selectedCategory 
}: ChatInterfaceProps) {
  const [userMessage, setUserMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch chat messages
  const { data: chatMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat-messages", sessionId],
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { query: string; isVoiceInput?: boolean }) => {
      const response = await apiRequest("POST", "/api/enhanced-search", {
        query: data.query,
        language: currentLanguage,
        userProfile: {
          name: user.name,
          phoneNumber: user.phoneNumber
        },
        symptoms: extractSymptomsFromMessage(data.query)
      });
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (data, variables) => {
      // Add user message
      const userMsg: Message = {
        id: `user_${Date.now()}`,
        message: variables.query,
        messageType: "user",
        language: currentLanguage,
        isVoiceInput: variables.isVoiceInput,
        createdAt: new Date()
      };

      // Add AI response
      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        message: data.message,
        messageType: "ai",
        language: currentLanguage,
        aiResponse: data.message,
        riskAssessment: data.riskAssessment,
        createdAt: new Date()
      };

      setMessages(prev => [...prev, userMsg, aiMsg]);
      setIsAITyping(false);
      
      // Save messages to backend
      saveMessage(userMsg);
      saveMessage(aiMsg);

      // Show emergency alert if required
      if (data.emergencyRequired) {
        toast({
          title: "Emergency Alert",
          description: "Your symptoms require immediate medical attention. Please call 108 or visit the nearest hospital.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setIsAITyping(false);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
      console.error("Send message error:", error);
    }
  });

  // Save message mutation
  const saveMessageMutation = useMutation({
    mutationFn: async (message: Partial<ChatMessage>) => {
      const response = await apiRequest("POST", "/api/chat-messages", {
        ...message,
        sessionId,
        userId: user.authenticated ? user.phoneNumber : null
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-messages", sessionId] });
    }
  });

  const saveMessage = (message: Message) => {
    saveMessageMutation.mutate({
      message: message.message,
      messageType: message.messageType,
      language: message.language,
      isVoiceInput: message.isVoiceInput,
      aiResponse: message.aiResponse,
      riskAssessment: message.riskAssessment
    });
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAITyping]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        message: getWelcomeMessage(currentLanguage),
        messageType: "ai",
        language: currentLanguage,
        createdAt: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [currentLanguage]);

  const handleSendMessage = () => {
    if (!userMessage.trim()) return;

    setIsAITyping(true);
    sendMessageMutation.mutate({ query: userMessage.trim() });
    setUserMessage("");
  };

  const handleVoiceInput = (transcript: string) => {
    if (!transcript.trim()) return;

    setIsAITyping(true);
    sendMessageMutation.mutate({ query: transcript.trim(), isVoiceInput: true });
  };

  const handleQuickQuery = (query: string) => {
    setIsAITyping(true);
    sendMessageMutation.mutate({ query });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <main className="flex-1 flex flex-col" data-testid="chat-interface">
      
      {/* Chat Header */}
      <div className="bg-card border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button className="lg:hidden text-muted-foreground hover:text-foreground">
            <i className="fas fa-bars text-xl"></i>
          </button>
          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
            <i className="fas fa-robot text-secondary-foreground"></i>
          </div>
          <div>
            <h2 className="font-bold">AI Health Assistant</h2>
            <p className="text-sm text-muted-foreground flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Online • Available 24/7
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Voice Toggle */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className={isVoiceMode ? "bg-secondary text-secondary-foreground" : ""}
            data-testid="voice-toggle"
          >
            <i className="fas fa-volume-up"></i>
          </Button>
          
          {/* Connection Status */}
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <i className="fab fa-whatsapp text-green-500"></i>
            <span>Connected</span>
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30" data-testid="chat-messages">
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.messageType === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`chat-bubble p-4 rounded-lg shadow-sm ${
              message.messageType === "user" 
                ? "bg-primary text-primary-foreground" 
                : "bg-card border-l-4 border-secondary"
            }`}>
              {message.messageType === "ai" && (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-robot text-secondary-foreground text-sm"></i>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-2">AI Health Assistant</p>
                    <div className="space-y-3">
                      <p className="text-sm">{message.message}</p>
                      
                      {/* Risk Assessment */}
                      {message.riskAssessment && (
                        <div className={`p-3 rounded-md border ${getRiskLevelStyling(message.riskAssessment.level)}`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <i className={`fas ${getRiskLevelIcon(message.riskAssessment.level)}`}></i>
                            <span className="font-medium">{message.riskAssessment.level} Risk Level</span>
                          </div>
                          {message.riskAssessment.recommendations.length > 0 && (
                            <div className="space-y-1">
                              <h4 className="font-medium text-sm">Recommendations:</h4>
                              <ul className="text-sm space-y-1">
                                {message.riskAssessment.recommendations.map((rec, index) => (
                                  <li key={index} className="flex items-start space-x-2">
                                    <i className="fas fa-check-circle text-green-500 mt-0.5 flex-shrink-0"></i>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {message.createdAt.toLocaleTimeString()} • Powered by AI
                    </p>
                  </div>
                </div>
              )}
              
              {message.messageType === "user" && (
                <div>
                  <p className="text-sm">{message.message}</p>
                  <p className="text-xs opacity-75 mt-2">
                    {message.createdAt.toLocaleTimeString()}
                    {message.isVoiceInput && <i className="fas fa-microphone ml-1"></i>}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isAITyping && (
          <div className="flex justify-start">
            <div className="chat-bubble bg-card p-4 rounded-lg shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                  <i className="fas fa-robot text-secondary-foreground text-sm"></i>
                </div>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-card border-t border-border p-4">
        <div className="flex items-end space-x-3">
          
          {/* Voice Input */}
          <VoiceInput 
            language={currentLanguage}
            onTranscription={handleVoiceInput}
            isEnabled={isVoiceMode}
          />

          {/* Text Input */}
          <div className="flex-1 relative">
            <Textarea 
              placeholder={getInputPlaceholder(currentLanguage)}
              className="resize-none pr-12"
              rows={1}
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              data-testid="message-input"
            />
            
            {/* Send Button */}
            <Button 
              size="sm"
              className="absolute right-2 bottom-2"
              onClick={handleSendMessage}
              disabled={!userMessage.trim() || sendMessageMutation.isPending}
              data-testid="send-button"
            >
              <i className="fas fa-paper-plane text-sm"></i>
            </Button>
          </div>

          {/* Attachment Button */}
          <Button 
            variant="outline" 
            size="sm"
            data-testid="attachment-button"
          >
            <i className="fas fa-paperclip text-lg"></i>
          </Button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          {getQuickActions(currentLanguage).map((action) => (
            <Button
              key={action.key}
              variant="outline"
              size="sm"
              onClick={() => handleQuickQuery(action.query)}
              data-testid={`quick-action-${action.key}`}
            >
              <i className={`fas ${action.icon} mr-1`}></i>
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </main>
  );
}

// Helper functions
function getWelcomeMessage(language: string): string {
  const messages: Record<string, string> = {
    en: "Hello! I'm your AI Health Assistant. You can ask me any health-related questions. You can type or speak using the microphone.",
    hi: "नमस्ते! मैं आपका AI स्वास्थ्य सहायक हूं। आप मुझसे किसी भी स्वास्थ्य संबंधी प्रश्न के बारे में पूछ सकते हैं। आप टाइप कर सकते हैं या माइक का उपयोग करके बोल सकते हैं।",
    or: "ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କର AI ସ୍ୱାସ୍ଥ୍ୟ ସହାୟକ। ଆପଣ ମୋତେ କୌଣସି ସ୍ୱାସ୍ଥ୍ୟ ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନ ପଚାରିପାରିବେ।",
    bn: "নমস্কার! আমি আপনার AI স্বাস্থ্য সহায়ক। আপনি আমাকে যেকোনো স্বাস্থ্য সম্পর্কিত প্রশ্ন করতে পারেন।",
    te: "నమస్కారం! నేను మీ AI ఆరోగ్య సహాయకుడిని। మీరు నన్ను ఏదైనా ఆరోగ్య సంబంధిత ప్రశ్న అడగవచ్చు।",
    ta: "வணக்கம்! நான் உங்கள் AI சுகாதார உதவியாளர். நீங்கள் என்னிடம் எந்த சுகாதார தொடர்பான கேள்விகளையும் கேட்கலாம்।"
  };
  return messages[language] || messages.en;
}

function getInputPlaceholder(language: string): string {
  const placeholders: Record<string, string> = {
    en: "Type your health question here... (or use microphone)",
    hi: "यहाँ अपना स्वास्थ्य प्रश्न टाइप करें... (या माइक का उपयोग करें)",
    or: "ଏଠାରେ ଆପଣଙ୍କର ସ୍ୱାସ୍ଥ୍ୟ ପ୍ରଶ୍ନ ଟାଇପ୍ କରନ୍ତୁ...",
    bn: "এখানে আপনার স্বাস্থ্য প্রশ্ন টাইপ করুন...",
    te: "ఇక్కడ మీ ఆరోగ్య ప్రశ్నను టైప్ చేయండి...",
    ta: "இங்கே உங்கள் சுகாதார கேள்வியை தட்டச்சு செய்யுங்கள்..."
  };
  return placeholders[language] || placeholders.en;
}

function getQuickActions(language: string) {
  const actions = [
    { key: "fever", icon: "fa-thermometer-half", query: "fever symptoms", label: "Fever" },
    { key: "cough", icon: "fa-lungs", query: "cough treatment", label: "Cough" },
    { key: "vaccination", icon: "fa-syringe", query: "vaccination schedule", label: "Vaccination" },
    { key: "hospital", icon: "fa-hospital", query: "nearby hospital", label: "Hospital" }
  ];

  const translations: Record<string, Record<string, string>> = {
    hi: {
      "Fever": "बुखार",
      "Cough": "खांसी", 
      "Vaccination": "टीकाकरण",
      "Hospital": "अस्पताल"
    },
    or: {
      "Fever": "ଜ୍ୱର",
      "Cough": "କାଶ",
      "Vaccination": "ଟୀକାକରଣ", 
      "Hospital": "ଡାକ୍ତରଖାନା"
    },
    bn: {
      "Fever": "জ্বর",
      "Cough": "কাশি",
      "Vaccination": "টিকাদান",
      "Hospital": "হাসপাতাল"
    },
    te: {
      "Fever": "జ్వరం",
      "Cough": "దగ్గు",
      "Vaccination": "టీకా",
      "Hospital": "ఆసుపత్రి"
    },
    ta: {
      "Fever": "காய்ச்சல்",
      "Cough": "இருமல்",
      "Vaccination": "தடுப்பூசி",
      "Hospital": "மருத்துவமனை"
    }
  };

  return actions.map(action => ({
    ...action,
    label: translations[language]?.[action.label] || action.label
  }));
}

function getRiskLevelStyling(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "bg-red-100 border-red-300 text-red-800";
    case "HIGH":
      return "bg-orange-100 border-orange-300 text-orange-800";
    case "MEDIUM":
      return "bg-yellow-100 border-yellow-300 text-yellow-800";
    case "LOW":
      return "bg-green-100 border-green-300 text-green-800";
    default:
      return "bg-gray-100 border-gray-300 text-gray-800";
  }
}

function getRiskLevelIcon(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "fa-exclamation-triangle text-red-600";
    case "HIGH":
      return "fa-exclamation-circle text-orange-600";
    case "MEDIUM":
      return "fa-info-circle text-yellow-600";
    case "LOW":
      return "fa-check-circle text-green-600";
    default:
      return "fa-question-circle text-gray-600";
  }
}

function extractSymptomsFromMessage(message: string): string[] {
  // Basic symptom extraction - in production, this would be more sophisticated
  const commonSymptoms = [
    "fever", "headache", "cough", "cold", "pain", "nausea", "vomiting", 
    "diarrhea", "fatigue", "weakness", "dizziness", "chest pain", "breathing difficulty",
    "बुखार", "सिरदर्द", "खांसी", "दर्द", "ଜ୍ୱର", "ମୁଣ୍ଡବିନ୍ଧା", "জ্বর", "মাথাব্যথা",
    "జ్వరం", "తలనొప్పి", "காய்ச்சல்", "தலைவலி"
  ];
  
  const lowerMessage = message.toLowerCase();
  return commonSymptoms.filter(symptom => lowerMessage.includes(symptom.toLowerCase()));
}
