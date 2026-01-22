// Speech Recognition utility using Web Speech API (works in mobile browsers)
// This is a browser-based API that works without external API keys

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

export const startSpeechRecognition = (): Promise<SpeechRecognitionResult> => {
  return new Promise((resolve, reject) => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported'));
      return;
    }

    const recognition = new SpeechRecognition();
    
    // Configure recognition
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-IN'; // English - India for South Indian accents

    recognition.onresult = (event: any) => {
      const result = event.results[0][0];
      resolve({
        transcript: result.transcript,
        confidence: result.confidence,
      });
    };

    recognition.onerror = (event: any) => {
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      // Recognition ended
    };

    // Start recognition
    recognition.start();
  });
};
