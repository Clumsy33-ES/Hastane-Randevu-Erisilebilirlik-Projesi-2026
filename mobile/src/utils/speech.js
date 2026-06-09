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
    this.shouldBeListening = false;
    this.activeListener = null; // Stores { onResult, onEnd, onError, onStart }
    this.restartTimer = null;
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
      // 1. speak başlamadan önce her zaman stop çağır
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } else {
        try {
          await Speech.stop();
        } catch (e) {
          console.log('[Speech] Error stopping native speech', e);
        }
      }

      if (!text || text.trim() === '') return;

      // Prevent duplicate reading on re-renders, unless forced (e.g., manual "listen again")
      if (!force && text === this.lastSpokenText) {
        console.log('[voiceService] Skipping duplicate speech:', text);
        return;
      }
      this.lastSpokenText = text;
      this.isSpeaking = true;

      // Save state to resume microphone after speech finishes
      const wasListening = this.shouldBeListening;
      const savedListener = this.activeListener;

      // Stop listening while speaking to prevent feedback loops
      if (wasListening) {
        this.stopListeningInternal();
      }

      const handleSpeechFinished = () => {
        this.isSpeaking = false;
        if (onDone) onDone();
        // Resume listening if we were listening before speaking started
        if (wasListening && savedListener) {
          this.startListening(
            savedListener.onResult,
            savedListener.onEnd,
            savedListener.onError,
            savedListener.onStart
          );
        }
      };

      // ─── Web Speech Synthesis Fallback ──────────────────────────────────
      if (Platform.OS === 'web') {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'tr-TR';
          utterance.rate = 1.15;
          utterance.pitch = 1.0;
          utterance.onend = handleSpeechFinished;
          utterance.onerror = (e) => {
            console.log('[Speech] TTS Web Error', e);
            handleSpeechFinished();
          };
          window.speechSynthesis.speak(utterance);
        } else {
          handleSpeechFinished();
        }
        return;
      }

      // ─── Native / Expo Go TTS ───────────────────────────────────────────
      Speech.speak(text, {
        language: 'tr-TR',
        rate: 1.15,
        pitch: 1.0,
        onDone: handleSpeechFinished,
        onStopped: () => {
          this.isSpeaking = false;
        },
        onError: (err) => {
          console.log('[Speech] TTS Error', err);
          handleSpeechFinished();
        },
      });
    } catch (error) {
      console.log('[voiceService Error]', error.message);
      this.isSpeaking = false;
    }
  }

  stopSpeaking() {
    try {
      // 4. Screen blur/unmount / logout olunca:
      if (typeof window !== 'undefined' && window.speechSynthesis?.cancel) {
        window.speechSynthesis.cancel();
      }
      Speech.stop().catch(() => {});
      this.isSpeaking = false;
    } catch (error) {
      console.log('[voiceService Stop Error]', error.message);
    }
  }

  startListening(onResult, onEnd, onError, onStart) {
    this.shouldBeListening = true;
    this.activeListener = { onResult, onEnd, onError, onStart };

    const startActual = () => {
      if (!this.shouldBeListening) return;

      // Stop any active session
      this.stopListeningInternal();

      this.recognitionService = new VoiceRecognitionService(
        (text) => {
          if (onResult) onResult(text);
        },
        () => {
          this.isListening = false;
          if (onEnd) onEnd();

          // Auto-restart if we should still be listening and not speaking
          if (this.shouldBeListening && !this.isSpeaking) {
            if (this.restartTimer) clearTimeout(this.restartTimer);
            this.restartTimer = setTimeout(() => {
              startActual();
            }, 400); // Small delay before restarting
          }
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
    };

    startActual();
  }

  stopListeningInternal() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognitionService) {
      this.recognitionService.stop().catch(() => {});
      this.recognitionService.destroy().catch(() => {});
      this.recognitionService = null;
    }
    this.isListening = false;
  }

  stopListening() {
    this.shouldBeListening = false;
    this.activeListener = null;
    this.stopListeningInternal();
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
