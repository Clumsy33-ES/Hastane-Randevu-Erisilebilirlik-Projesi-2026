import * as Speech from 'expo-speech';
import { VoiceRecognitionService } from './voiceRecognition';
import { AppState, Platform } from 'react-native';

class VoiceService {
  constructor() {
    this.lastSpokenText = '';
    this.lastSpokenScreen = '';
    this.recognitionService = null;
    this.isSpeaking = false;
    this.isListening = false;
    this.appStateSubscription = null;

    // Stop speech and listening if app goes to background
    if (Platform.OS !== 'web') {
      this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          this.stopSpeaking();
          this.stopListening();
        }
      });
    }
  }

  setScreen(screenName) {
    if (this.lastSpokenScreen !== screenName) {
      this.lastSpokenScreen = screenName;
      this.lastSpokenText = ''; // Clear duplicate detection cache on screen transition
    }
  }

  async speak(text, onDone = null, force = false) {
    try {
      if (!text || text.trim() === '') return;

      // Prevent duplicate reading on re-renders, unless forced (e.g., manual "listen again")
      if (!force && text === this.lastSpokenText) {
        console.log('[voiceService] Skipping duplicate speech:', text);
        return;
      }
      this.lastSpokenText = text;
      this.isSpeaking = true;

      // Always clear previous speech before starting a new one
      await Speech.stop();

      Speech.speak(text, {
        language: 'tr-TR',
        rate: 1.2,
        pitch: 1.0,
        onDone: () => {
          this.isSpeaking = false;
          if (onDone) onDone();
        },
        onStopped: () => {
          this.isSpeaking = false;
        },
        onError: (err) => {
          console.log('[voiceService Error]', err);
          this.isSpeaking = false;
        },
      });
    } catch (error) {
      console.log('[voiceService Error]', error.message);
      this.isSpeaking = false;
    }
  }

  stopSpeaking() {
    try {
      Speech.stop();
      this.isSpeaking = false;
    } catch (error) {
      console.log('[voiceService Stop Error]', error.message);
    }
  }

  startListening(onResult, onEnd, onError, onStart) {
    // Stop any existing listener
    this.stopListening();

    this.recognitionService = new VoiceRecognitionService(
      (text) => {
        if (onResult) onResult(text);
      },
      () => {
        this.isListening = false;
        if (onEnd) onEnd();
      },
      (err) => {
        this.isListening = false;
        if (onError) onError(err);
      },
      () => {
        this.isListening = true;
        if (onStart) onStart();
      }
    );

    this.recognitionService.start().catch((err) => {
      console.log('[voiceService startListening Error]', err);
    });
  }

  stopListening() {
    if (this.recognitionService) {
      this.recognitionService.stop().catch(() => {});
      this.recognitionService.destroy().catch(() => {});
      this.recognitionService = null;
    }
    this.isListening = false;
  }

  cleanup() {
    this.stopSpeaking();
    this.stopListening();
    this.lastSpokenText = '';
    this.lastSpokenScreen = '';
  }
}

export const voiceService = new VoiceService();

// Maintain legacy exports for backward compatibility
export const speak = (text, onDone = null) => {
  voiceService.speak(text, onDone);
};

export const stopSpeech = () => {
  voiceService.stopSpeaking();
};
