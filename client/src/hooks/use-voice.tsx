import { useState, useEffect, useCallback, useRef } from "react";

// Type declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

interface UseVoiceOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

interface UseVoiceReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  hasRecognitionSupport: boolean;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const {
    language = "en-US",
    continuous = true,
    interimResults = true,
    maxAlternatives = 1
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = typeof window !== "undefined" && 
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      recognitionRef.current = new SpeechRecognitionClass();
      const recognition = recognitionRef.current;

      if (recognition) {
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = language;
        recognition.maxAlternatives = maxAlternatives;
      }

      if (recognition) {
        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptPart = result[0].transcript;

            if (result.isFinal) {
              finalTranscript += transcriptPart;
              setConfidence(result[0].confidence);
            } else {
              interimTranscript += transcriptPart;
            }
          }

          setTranscript(finalTranscript || interimTranscript);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          setError(event.error);
          setIsListening(false);
          
          // Provide user-friendly error messages
          const errorMessages: Record<string, string> = {
            "network": "Network error. Please check your internet connection.",
            "not-allowed": "Microphone access denied. Please allow microphone permissions.",
            "no-speech": "No speech detected. Please try speaking again.",
            "audio-capture": "Microphone not available. Please check your microphone.",
            "service-not-allowed": "Speech recognition service not available.",
            "aborted": "Speech recognition was aborted.",
            "language-not-supported": "Language not supported for voice recognition."
          };
          
          setError(errorMessages[event.error] || `Speech recognition error: ${event.error}`);
        };

        recognition.onnomatch = () => {
          setError("No speech was recognized");
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, continuous, interimResults, maxAlternatives, isSupported]);

  const startListening = useCallback(async (): Promise<void> => {
    if (!recognitionRef.current || isListening) return;

    try {
      // Request microphone permissions
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setTranscript("");
      setError(null);
      setConfidence(0);
      
      recognitionRef.current.start();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to access microphone";
      setError(errorMessage);
      console.error("Failed to start speech recognition:", err);
      throw new Error(errorMessage);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setConfidence(0);
    setError(null);
  }, []);

  // Check if browser has recognition support
  const hasRecognitionSupport = isSupported && !!recognitionRef.current;

  return {
    isSupported,
    isListening,
    transcript,
    confidence,
    error,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport
  };
}
