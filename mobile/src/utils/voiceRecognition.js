/**
 * voiceRecognition.js
 *
 * Unified voice recognition abstraction layer.
 *
 * Modes:
 *  - 'web'        : Browser SpeechRecognition API (Chrome, Edge, Safari on web)
 *  - 'native'     : @react-native-voice/voice on a real device or custom dev client
 *  - 'simulation' : Expo Go fallback — buttons replace voice input
 *
 * The mode is automatically detected at runtime.
 * NEVER crash in Expo Go; always fall back to simulation safely.
 */

import { Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';

/**
 * Check audio recording permission on Android without requesting it.
 */
export const checkMicrophonePermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return granted;
    } catch (err) {
      console.warn('[Permission Check Error]', err);
      return false;
    }
  }
  return true;
};

/**
 * Request audio recording permission on Android.
 */
export const requestMicrophonePermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Mikrofon İzni',
          message: 'Sesli asistanı kullanabilmeniz için mikrofon izni gereklidir.',
          buttonPositive: 'İzin Ver',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[Permission Error]', err);
      return false;
    }
  }
  return true;
};

// ─── Expo Go detection ───────────────────────────────────────────────────────
// executionEnvironment is 'storeClient' in Expo Go, 'standalone' or 'bare' otherwise.
const executionEnv = Constants?.executionEnvironment || Constants?.appOwnership || '';
export const isExpoGo =
  executionEnv === 'storeClient' ||
  executionEnv === 'expo' ||
  Platform.OS === 'android' // Treat Android Expo Go as simulation (no native voice module bundled)
    ? (executionEnv === 'storeClient' || executionEnv === 'expo')
    : false;

// ─── Native Voice module — safe optional require ─────────────────────────────
let NativeVoice = null;
if (!isExpoGo && Platform.OS !== 'web') {
  try {
    NativeVoice = require('@react-native-voice/voice').default;
    // Validate that the module actually has working methods
    if (!NativeVoice || typeof NativeVoice.start !== 'function') {
      console.log('[voiceRecognition] NativeVoice module loaded but .start() is not a function — treating as unavailable.');
      NativeVoice = null;
    }
  } catch (e) {
    console.log('[voiceRecognition] @react-native-voice/voice not available:', e.message);
    NativeVoice = null;
  }
}

// ─── Mode detection helpers ──────────────────────────────────────────────────

/**
 * Returns true if Web SpeechRecognition API is available (browser only).
 */
export const isWebVoiceSupported = () => {
  if (Platform.OS !== 'web') return false;
  try {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return typeof SR !== 'undefined';
  } catch {
    return false;
  }
};

/**
 * Returns true if native @react-native-voice/voice is available and usable.
 * This is FALSE in Expo Go — only works in custom dev client or production build.
 */
export const isNativeVoiceSupported = () => {
  return !!(NativeVoice && typeof NativeVoice.start === 'function');
};

/**
 * Detect and return the recognition mode string.
 *  'web'        — Web Speech API available (browser)
 *  'native'     — Real native voice module available
 *  'simulation' — Expo Go or unsupported environment; use button fallback
 */
export const detectRecognitionMode = () => {
  if (isWebVoiceSupported()) return 'web';
  if (isNativeVoiceSupported()) return 'native';
  return 'simulation';
};

// ─── VoiceRecognitionService ─────────────────────────────────────────────────

/**
 * Platform-agnostic voice recognition service.
 *
 * Usage:
 *   const svc = new VoiceRecognitionService(onResult, onEnd, onError, onStart);
 *   await svc.start();
 *   await svc.stop();
 *   await svc.destroy();
 */
export class VoiceRecognitionService {
  constructor(onResult, onEnd, onError, onStart) {
    this.onResult = onResult;
    this.onEnd    = onEnd;
    this.onError  = onError;
    this.onStart  = onStart;

    this.webRecognition = null; // Web Speech API instance
    this.mode = detectRecognitionMode();

    this._initWeb();
    this._initNative();
  }

  // ── Web Speech API setup ──────────────────────────────────────────────────
  _initWeb() {
    if (this.mode !== 'web') return;
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.webRecognition = new SR();
      this.webRecognition.lang = 'tr-TR';
      this.webRecognition.continuous = false;
      this.webRecognition.interimResults = false;
      this.webRecognition.maxAlternatives = 1;

      this.webRecognition.onstart = () => {
        if (this.onStart) this.onStart();
      };
      this.webRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (this.onResult) this.onResult(transcript);
      };
      this.webRecognition.onerror = (event) => {
        console.log('[WebSpeech Error]', event.error);
        if (this.onError) this.onError(event.error);
      };
      this.webRecognition.onend = () => {
        if (this.onEnd) this.onEnd();
      };
    } catch (e) {
      console.error('[VoiceRecognitionService] Web init error:', e);
      this.webRecognition = null;
    }
  }

  // ── Native Voice setup ────────────────────────────────────────────────────
  _initNative() {
    if (this.mode !== 'native' || !NativeVoice) return;
    try {
      NativeVoice.onSpeechStart   = () => { if (this.onStart) this.onStart(); };
      NativeVoice.onSpeechResults = (e) => {
        if (e?.value?.length > 0 && this.onResult) {
          this.onResult(e.value[0]);
        }
      };
      NativeVoice.onSpeechError = (e) => {
        console.log('[NativeVoice Error]', e?.error);
        if (this.onError) this.onError(e?.error);
      };
      NativeVoice.onSpeechEnd = () => { if (this.onEnd) this.onEnd(); };
    } catch (e) {
      console.error('[VoiceRecognitionService] Native init error:', e);
    }
  }

  // ── start() ───────────────────────────────────────────────────────────────
  async start() {
    try {
      if (this.mode === 'web' && this.webRecognition) {
        this.webRecognition.start();

      } else if (this.mode === 'native' && NativeVoice) {
        await NativeVoice.start('tr-TR');

      } else {
        // Simulation mode — do nothing; buttons handle input
        console.log('[VoiceRecognitionService] Simulation mode: voice input via buttons.');
      }
    } catch (e) {
      console.error('[VoiceRecognitionService] start() error:', e.message);
      if (this.onError) this.onError(e.message);
    }
  }

  // ── stop() ────────────────────────────────────────────────────────────────
  async stop() {
    try {
      if (this.mode === 'web' && this.webRecognition) {
        this.webRecognition.stop();

      } else if (this.mode === 'native' && NativeVoice) {
        await NativeVoice.stop();
      }
    } catch (e) {
      console.error('[VoiceRecognitionService] stop() error:', e.message);
    }
  }

  // ── destroy() ─────────────────────────────────────────────────────────────
  async destroy() {
    try {
      if (this.mode === 'web' && this.webRecognition) {
        this.webRecognition.onstart  = null;
        this.webRecognition.onresult = null;
        this.webRecognition.onerror  = null;
        this.webRecognition.onend    = null;
        this.webRecognition.stop();
        this.webRecognition = null;

      } else if (this.mode === 'native' && NativeVoice) {
        await NativeVoice.destroy();
        NativeVoice.onSpeechStart   = null;
        NativeVoice.onSpeechResults = null;
        NativeVoice.onSpeechError   = null;
        NativeVoice.onSpeechEnd     = null;
      }
    } catch (e) {
      console.error('[VoiceRecognitionService] destroy() error:', e.message);
    }
  }
}
