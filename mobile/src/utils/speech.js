import * as Speech from 'expo-speech';
import {
  VoiceRecognitionService,
  detectRecognitionMode,
  requestMicrophonePermission,
} from './voiceRecognition';
import { isPresentationMode } from './buildConfig';
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

    // Dev: STT varsayılan açık. Production APK: mikrofon otomatik başlamaz.
    this.voiceEnabled = !isPresentationMode();
    this.onVoiceEnabledChange = null;

    // Status listener pattern — used by VoiceDebugScreen and App.js
    this._statusListeners = [];
    this.diagnostics = {
      lastDetectedText: '(yok)',
      lastRawError: '(yok)',
      lastEndEventTime: '(hiç)',
      listeningStatus: 'Durduruldu',
    };

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

  addStatusListener(callback) {
    if (typeof callback === 'function' && !this._statusListeners.includes(callback)) {
      this._statusListeners.push(callback);
    }
  }

  removeStatusListener(callback) {
    this._statusListeners = this._statusListeners.filter(fn => fn !== callback);
  }

  _notifyStatusListeners() {
    const snap = { ...this.diagnostics };
    this._statusListeners.forEach(fn => {
      try { fn(snap); } catch (e) { /* ignore */ }
    });
  }

  _updateDiagnostics(patch) {
    this.diagnostics = { ...this.diagnostics, ...patch };
    this._notifyStatusListeners();
  }


  setVoiceEnabled(enabled) {
    this.voiceEnabled = enabled;
    if (this.onVoiceEnabledChange) {
      this.onVoiceEnabledChange(enabled);
    }
    if (!enabled) {
      this.cleanup();
      // Speak confirmation if disabled (forced)
      this.speak("Sesli asistan kapatıldı.", null, true);
    } else {
      this.speak("Sesli asistan açıldı. Nasıl yardımcı olabilirim?", null, true);
    }
  }

  /** Sunum modunda Sesli Asistan / Debug ekranı için STT'yi sessizce aç/kapat */
  enableSttForExperimentalScreen(enabled) {
    this.voiceEnabled = enabled;
    if (this.onVoiceEnabledChange) {
      this.onVoiceEnabledChange(enabled);
    }
    if (!enabled) {
      this.stopListening();
    }
  }

  handleGlobalCommand(transcript, navigateFn, logoutFn = null) {
    if (!transcript) return false;
    
    // Normalize transcript: lower case, trim, remove basic punctuation
    const norm = transcript
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, '');

    // Ses Aç / Kapat
    if (norm.includes('ses kapat') || norm.includes('sesli asistanı kapat') || norm.includes('mikrofonu kapat') || norm.includes('dinlemeyi durdur')) {
      this.setVoiceEnabled(false);
      return true;
    }
    if (norm.includes('ses aç') || norm.includes('sesli asistanı aç') || norm.includes('mikrofonu aç') || norm.includes('beni dinle')) {
      this.setVoiceEnabled(true);
      return true;
    }

    if (!this.voiceEnabled) {
      return false;
    }

    if (norm.includes('çıkış') || norm.includes('çıkış yap')) {
      if (logoutFn) {
        logoutFn();
        return true;
      }
    }

    // Global Routing Commands
    if (navigateFn) {
      if (norm.includes('randevu al') || norm.includes('hastane randevusu') || norm.includes('hastaneden randevu al')) {
        this.stopListening();
        this.speak('Hastane randevusu ekranı açılıyor.', null, true);
        navigateFn('appointment');
        return true;
      }
      if (norm.includes('randevularım') || norm.includes('randevular') || norm.includes('randevularimi gor')) {
        this.stopListening();
        this.speak('Randevularım ekranı açılıyor.', null, true);
        navigateFn('myAppointments');
        return true;
      }
      if (norm.includes('aile hekimi')) {
        this.stopListening();
        this.speak('Aile hekimi ekranı açılıyor.', null, true);
        navigateFn('familyPhysician');
        return true;
      }
      if (norm.includes('profil') || norm.includes('ayarlar')) {
        this.stopListening();
        this.speak('Profil ve ayarlar ekranı açılıyor.', null, true);
        navigateFn('profile');
        return true;
      }
      if (norm.includes('ana sayfa') || norm === 'geri' || norm === 'geri git') {
        this.stopListening();
        this.speak('Ana sayfaya dönülüyor.', null, true);
        navigateFn('home');
        return true;
      }
    }

    // "yardım", "tekrar et", "seçenekleri söyle" will be ignored here (return false)
    // so the individual screens can handle them and read their specific help text.
    if (norm.includes('yardım') || norm.includes('tekrar et') || norm.includes('seçenekleri söyle')) {
      return false; 
    }

    return false; // Not a global command
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

      // Skip normal speech if voice is disabled (unless forced)
      if (!this.voiceEnabled && !force) {
        if (onDone) onDone();
        return;
      }

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

  startListening(onResult, onEnd, onError, onStart, { screenName } = {}) {
    if (!this.voiceEnabled) {
      console.log("[voiceService] Listening blocked, voiceEnabled is false.");
      return;
    }

    if (isPresentationMode() && screenName && !['voiceCommandAssistant', 'voiceDebug'].includes(screenName)) {
      console.log("[voiceService] STT blocked in presentation mode for screen:", screenName);
      return;
    }

    this.shouldBeListening = true;
    this.activeListener = { onResult, onEnd, onError, onStart };

    const startActual = async () => {
      if (!this.shouldBeListening || !this.voiceEnabled) return;

      // Native APK: request mic permission before starting STT
      if (Platform.OS !== 'web' && detectRecognitionMode() === 'native') {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          console.log('[voiceService] Microphone permission denied — cannot start listening.');
          if (onError) onError('Mikrofon izni reddedildi');
          this._updateDiagnostics({ listeningStatus: 'İzin reddedildi', lastRawError: 'Mikrofon izni reddedildi' });
          return;
        }
      }

      // Stop any active session
      this.stopListeningInternal();

      this._updateDiagnostics({ listeningStatus: 'Başlatılıyor...' });

      this.recognitionService = new VoiceRecognitionService(
        (text) => {
          console.log('[voiceService] STT result:', text);
          this._updateDiagnostics({
            lastDetectedText: text || '(boş)',
            listeningStatus: 'Sonuç alındı',
          });
          if (onResult) onResult(text);
        },
        () => {
          this.isListening = false;
          this._updateDiagnostics({
            listeningStatus: 'Dinleme bitti',
            lastEndEventTime: new Date().toLocaleTimeString(),
          });
          if (onEnd) onEnd();

          // Auto-restart if we should still be listening and not speaking
          if (this.shouldBeListening && !this.isSpeaking) {
            if (this.restartTimer) clearTimeout(this.restartTimer);
            this.restartTimer = setTimeout(() => {
              this._updateDiagnostics({ listeningStatus: 'Yeniden başlatılıyor...' });
              startActual();
            }, 400);
          }
        },
        (err) => {
          this.isListening = false;
          const errMsg = typeof err === 'string' ? err : JSON.stringify(err);
          this._updateDiagnostics({ listeningStatus: `Hata: ${errMsg}`, lastRawError: errMsg });
          if (onError) onError(err);
        },
        () => {
          this.isListening = true;
          this._updateDiagnostics({ listeningStatus: 'Dinleniyor...' });
          if (onStart) onStart();
        }
      );

      this.recognitionService.start().catch((err) => {
        console.log('[voiceService startListening Error]', err);
        this._updateDiagnostics({ listeningStatus: `Başlatma hatası: ${err}`, lastRawError: String(err) });
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
