import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/hooks/use-voice";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  language: string;
  onTranscription: (transcript: string) => void;
  isEnabled: boolean;
}

export default function VoiceInput({ language, onTranscription, isEnabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const { toast } = useToast();
  
  const {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    hasRecognitionSupport
  } = useVoice({
    language: getVoiceLanguageCode(language),
    continuous: false,
    interimResults: true
  });

  useEffect(() => {
    if (transcript && !isListening) {
      onTranscription(transcript);
      setRecordingStatus("");
    }
  }, [transcript, isListening, onTranscription]);

  useEffect(() => {
    if (isListening) {
      setRecordingStatus(`Recording... Speak now (${getLanguageName(language)} supported)`);
    } else {
      setRecordingStatus("");
    }
  }, [isListening, language]);

  const handleVoiceToggle = async () => {
    if (!isSupported || !hasRecognitionSupport) {
      toast({
        title: "Voice Not Supported",
        description: "Voice recognition is not supported in your browser. Please use a modern browser like Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    if (!isEnabled) {
      toast({
        title: "Voice Input Disabled",
        description: "Please enable voice mode using the voice toggle button first.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isListening) {
        stopListening();
        setIsRecording(false);
      } else {
        await startListening();
        setIsRecording(true);
      }
    } catch (error) {
      console.error("Voice recognition error:", error);
      toast({
        title: "Voice Recognition Error",
        description: "Failed to start voice recognition. Please check your microphone permissions.",
        variant: "destructive",
      });
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Button
        variant={isListening ? "destructive" : "secondary"}
        size="lg"
        className={`p-3 rounded-full ${isListening ? "voice-recording" : ""}`}
        onClick={handleVoiceToggle}
        disabled={!isSupported || !hasRecognitionSupport}
        data-testid="voice-input-button"
      >
        <i className={`fas ${isListening ? "fa-stop" : "fa-microphone"} text-lg`}></i>
      </Button>

      {/* Recording Status */}
      {recordingStatus && (
        <div className="mt-2 text-center">
          <p className="text-sm text-muted-foreground" data-testid="recording-status">
            <i className="fas fa-circle text-red-500 mr-2"></i>
            {recordingStatus}
          </p>
          
          {/* Voice Wave Animation */}
          {isListening && (
            <div className="voice-wave mt-2 flex justify-center">
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
            </div>
          )}
        </div>
      )}

      {/* Interim transcript display */}
      {transcript && isListening && (
        <div className="mt-2 p-2 bg-muted rounded-md max-w-xs">
          <p className="text-sm text-muted-foreground">
            Listening: "{transcript}"
          </p>
        </div>
      )}

      {/* Browser compatibility warning */}
      {!isSupported && (
        <p className="text-xs text-destructive mt-2 text-center max-w-xs">
          Voice input requires a modern browser with microphone access
        </p>
      )}
    </div>
  );
}

// Helper functions
function getVoiceLanguageCode(code: string): string {
  // Map our language codes to Web Speech API language codes
  const mapping: Record<string, string> = {
    "en": "en-US",
    "hi": "hi-IN",
    "or": "or-IN", // Odia
    "bn": "bn-IN", // Bengali
    "te": "te-IN", // Telugu
    "ta": "ta-IN"  // Tamil
  };
  return mapping[code] || "en-US";
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    "en": "English",
    "hi": "Hindi",
    "or": "Odia",
    "bn": "Bengali",
    "te": "Telugu", 
    "ta": "Tamil"
  };
  return languages[code] || "English";
}
