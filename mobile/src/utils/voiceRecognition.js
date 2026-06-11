/**
 * voiceRecognition.js
 *
 * Unified voice recognition abstraction layer.
 *
 * Modes:
 *  - 'web'        : Browser SpeechRecognition API (Chrome, Edge, Safari on web)
 *  - 'native'     : expo-speech-recognition on APK / dev build (Android SpeechRecognizer)
 *  - 'simulation' : Expo Go fallback — buttons replace voice input
 *
 * Platform.OS === 'web' always uses Web Speech API.
 * Android/iOS native builds use expo-speech-recognition (never Web Speech API).
 */

import { Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';

// ─── Debug state (surfaced in VoiceDebugScreen) ──────────────────────────────
let lastVoiceError = null;
let lastRecognizedText = null;

export const getLastVoiceError = () => lastVoiceError;
export const getLastRecognizedText = () => lastRecognizedText;

// ─── Expo Go detection ───────────────────────────────────────────────────────
const executionEnv = Constants?.executionEnvironment || Constants?.appOwnership || '';
export const isExpoGo =
  executionEnv === 'storeClient' || executionEnv === 'expo';

// ─── Native speech recognition module — safe optional require ──────────────
let ExpoSpeechRecognition = null;
let nativeModuleLoadError = null;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    const speechPkg = require('expo-speech-recognition');
    ExpoSpeechRecognition = speechPkg?.ExpoSpeechRecognitionModule ?? null;
    if (!ExpoSpeechRecognition || typeof ExpoSpeechRecognition.start !== 'function') {
      nativeModuleLoadError = 'expo-speech-recognition yüklendi ancak start() bulunamadı';
      ExpoSpeechRecognition = null;
    }
  } catch (e) {
    nativeModuleLoadError = e?.message || String(e);
    ExpoSpeechRecognition = null;
  }
}

export const isNativeModuleLoaded = () => !!ExpoSpeechRecognition;

/**
 * Safely invoke a synchronous native bridge method.
 * Returns fallback if the method is missing or throws.
 */
const safeNativeSync = (methodName, fallback = null) => {
  try {
    const fn = ExpoSpeechRecognition?.[methodName];
    if (typeof fn !== 'function') return fallback;
    const result = fn.call(ExpoSpeechRecognition);
    return result ?? fallback;
  } catch (e) {
    console.warn(`[voiceRecognition] safeNativeSync(${methodName}) failed:`, e?.message || e);
    return fallback;
  }
};

/**
 * Check audio recording permission without requesting it.
 */
export const checkMicrophonePermission = async () => {
  if (Platform.OS === 'web') return true;

  if (ExpoSpeechRecognition?.getPermissionsAsync) {
    try {
      const result = await ExpoSpeechRecognition.getPermissionsAsync();
      return !!result?.granted;
    } catch (err) {
      console.warn('[Permission Check Error]', err);
    }
  }

  if (Platform.OS === 'android') {
    try {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    } catch (err) {
      console.warn('[Permission Check Error]', err);
      return false;
    }
  }

  return true;
};

/**
 * Request audio recording permission on native platforms.
 */
export const requestMicrophonePermission = async () => {
  if (Platform.OS === 'web') return true;

  if (ExpoSpeechRecognition?.requestPermissionsAsync) {
    try {
      const result = await ExpoSpeechRecognition.requestPermissionsAsync();
      return !!result?.granted;
    } catch (err) {
      console.warn('[Permission Error]', err);
    }
  }

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
 * Returns true if native speech recognition is available.
 * FALSE in Expo Go — only works in custom dev client or production APK.
 */
export const isNativeVoiceSupported = () => {
  if (isExpoGo || Platform.OS === 'web' || !ExpoSpeechRecognition) return false;
  try {
    if (typeof ExpoSpeechRecognition.isRecognitionAvailable === 'function') {
      return !!safeNativeSync('isRecognitionAvailable', false);
    }
    return typeof ExpoSpeechRecognition.start === 'function';
  } catch {
    return false;
  }
};

/**
 * Detect and return the recognition mode string.
 */
export const detectRecognitionMode = () => {
  try {
    if (Platform.OS === 'web' && isWebVoiceSupported()) return 'web';
    if (isNativeVoiceSupported()) return 'native';
    return 'simulation';
  } catch {
    return 'unknown';
  }
};

/**
 * Safely read Android STT service list — may be unsupported on some APK builds.
 */
const safeGetAndroidSpeechServices = () => {
  if (Platform.OS !== 'android' || !ExpoSpeechRecognition) {
    return { services: null, defaultService: null, error: null };
  }

  let services = null;
  let defaultService = null;
  let error = null;

  try {
    const rawServices = safeNativeSync('getSpeechRecognitionServices', null);
    if (Array.isArray(rawServices)) {
      services = rawServices.filter((s) => s != null && s !== '').map(String);
    } else if (rawServices != null) {
      services = [String(rawServices)];
    }
  } catch (e) {
    error = `getSpeechRecognitionServices: ${e?.message || e}`;
  }

  try {
    const rawDefault = safeNativeSync('getDefaultRecognitionService', null);
    if (rawDefault != null && rawDefault !== '') {
      defaultService =
        typeof rawDefault === 'object'
          ? rawDefault?.packageName ?? JSON.stringify(rawDefault)
          : String(rawDefault);
    }
  } catch (e) {
    error = error
      ? `${error}; getDefaultRecognitionService: ${e?.message || e}`
      : `getDefaultRecognitionService: ${e?.message || e}`;
  }

  // Legacy / alternate method names — guarded, never crash
  if (!services) {
    try {
      const alt = safeNativeSync('getRecognitionServices', null)
        ?? safeNativeSync('getAvailableServices', null);
      if (Array.isArray(alt)) {
        services = alt.filter((s) => s != null).map(String);
      }
    } catch {
      // ignore
    }
  }

  return { services, defaultService, error };
};

const buildFallbackDebugInfo = (errorMsg) => ({
  platform: Platform.OS ?? 'unknown',
  executionEnvironment: executionEnv || 'unknown',
  isExpoGo,
  recognitionMode: 'unknown',
  microphonePermission: null,
  voiceAvailable: false,
  recognitionAvailable: false,
  speechServices: null,
  defaultRecognitionService: null,
  lastError: lastVoiceError,
  lastRecognizedText,
  voiceEnabled: true,
  nativeModuleLoaded: isNativeModuleLoaded(),
  nativeModuleLoadError,
  loadError: errorMsg || 'Ses tanıma bilgileri alınamadı.',
  sttServicesError: null,
});

/**
 * Collect diagnostic info for the debug screen.
 * Never throws — always returns a usable object.
 */
export const getVoiceDebugInfo = async () => {
  try {
    let micGranted = null;
    try {
      micGranted = await checkMicrophonePermission();
    } catch (e) {
      micGranted = null;
      console.warn('[getVoiceDebugInfo] checkMicrophonePermission failed:', e);
    }

    let recognitionMode = 'unknown';
    try {
      recognitionMode = detectRecognitionMode();
    } catch {
      recognitionMode = 'unknown';
    }

    let recognitionAvailable = false;
    if (ExpoSpeechRecognition) {
      recognitionAvailable = !!safeNativeSync('isRecognitionAvailable', false);
    }

    const { services, defaultService, error: sttError } = safeGetAndroidSpeechServices();

    return {
      platform: Platform.OS,
      executionEnvironment: executionEnv || 'unknown',
      isExpoGo,
      recognitionMode,
      microphonePermission: micGranted,
      voiceAvailable: isNativeVoiceSupported(),
      recognitionAvailable,
      speechServices: services,
      defaultRecognitionService: defaultService,
      lastError: lastVoiceError,
      lastRecognizedText,
      voiceEnabled: true,
      nativeModuleLoaded: isNativeModuleLoaded(),
      nativeModuleLoadError,
      loadError: null,
      sttServicesError: sttError,
    };
  } catch (error) {
    console.error('[getVoiceDebugInfo] fatal:', error);
    return buildFallbackDebugInfo(String(error?.message || error));
  }
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
    this.onEnd = onEnd;
    this.onError = onError;
    this.onStart = onStart;

    this.webRecognition = null;
    this.nativeSubscriptions = [];
    this.mode = detectRecognitionMode();

    this._initWeb();
    this._initNative();
  }

  // ── Web Speech API setup (web platform only) ──────────────────────────────
  _initWeb() {
    if (Platform.OS !== 'web' || this.mode !== 'web') return;
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
        lastRecognizedText = transcript;
        if (this.onResult) this.onResult(transcript);
      };
      this.webRecognition.onerror = (event) => {
        console.log('[WebSpeech Error]', event.error);
        lastVoiceError = event.error;
        if (this.onError) this.onError(event.error);
      };
      this.webRecognition.onend = () => {
        if (this.onEnd) this.onEnd();
      };
    } catch (e) {
      console.error('[VoiceRecognitionService] Web init error:', e);
      lastVoiceError = e.message;
      this.webRecognition = null;
    }
  }

  // ── Native expo-speech-recognition setup ──────────────────────────────────
  _initNative() {
    if (this.mode !== 'native' || !ExpoSpeechRecognition) return;

    try {
      if (typeof ExpoSpeechRecognition.addListener !== 'function') {
        console.warn('[VoiceRecognitionService] addListener not available');
        return;
      }

      this.nativeSubscriptions = [
        ExpoSpeechRecognition.addListener('start', () => {
          if (this.onStart) this.onStart();
        }),
        ExpoSpeechRecognition.addListener('result', (event) => {
          const transcript = event.results?.[0]?.transcript ||
                             event.results?.[0]?.[0]?.transcript ||
                             event.transcript ||
                             event.value ||
                             event.text ||
                             "";
          if (!transcript) return;
          if (event.isFinal === false) return;
          lastRecognizedText = transcript;
          if (this.onResult) this.onResult(transcript);
        }),
        ExpoSpeechRecognition.addListener('error', (event) => {
          const errMsg = event?.message || event?.error || 'unknown-error';
          console.log('[NativeVoice Error]', errMsg);
          lastVoiceError = errMsg;
          if (this.onError) this.onError(errMsg);
        }),
        ExpoSpeechRecognition.addListener('end', () => {
          if (this.onEnd) this.onEnd();
        }),
      ];
    } catch (e) {
      console.error('[VoiceRecognitionService] Native init error:', e);
      lastVoiceError = e.message;
    }
  }

  _removeNativeListeners() {
    this.nativeSubscriptions.forEach((sub) => {
      try {
        sub?.remove?.();
      } catch {
        // ignore
      }
    });
    this.nativeSubscriptions = [];
  }

  // ── start() ───────────────────────────────────────────────────────────────
  async start() {
    try {
      if (Platform.OS === 'web' && this.mode === 'web' && this.webRecognition) {
        this.webRecognition.start();
        return;
      }

      if (this.mode === 'native' && ExpoSpeechRecognition) {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
          const err = 'Mikrofon izni reddedildi';
          lastVoiceError = err;
          if (this.onError) this.onError(err);
          return;
        }

        ExpoSpeechRecognition.start({
          lang: 'tr-TR',
          interimResults: false,
          continuous: false,
          maxAlternatives: 1,
          androidIntentOptions: {
            EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
            EXTRA_MASK_OFFENSIVE_WORDS: false,
          },
        });
        return;
      }

      console.log('[VoiceRecognitionService] Simulation mode: voice input via buttons.');
    } catch (e) {
      console.error('[VoiceRecognitionService] start() error:', e.message);
      lastVoiceError = e.message;
      if (this.onError) this.onError(e.message);
    }
  }

  // ── stop() ────────────────────────────────────────────────────────────────
  async stop() {
    try {
      if (Platform.OS === 'web' && this.mode === 'web' && this.webRecognition) {
        this.webRecognition.stop();
        return;
      }

      if (this.mode === 'native' && ExpoSpeechRecognition) {
        ExpoSpeechRecognition.stop();
      }
    } catch (e) {
      console.error('[VoiceRecognitionService] stop() error:', e.message);
      lastVoiceError = e.message;
    }
  }

  // ── destroy() ─────────────────────────────────────────────────────────────
  async destroy() {
    try {
      if (Platform.OS === 'web' && this.mode === 'web' && this.webRecognition) {
        this.webRecognition.onstart = null;
        this.webRecognition.onresult = null;
        this.webRecognition.onerror = null;
        this.webRecognition.onend = null;
        this.webRecognition.stop();
        this.webRecognition = null;
        return;
      }

      if (this.mode === 'native' && ExpoSpeechRecognition) {
        try {
          ExpoSpeechRecognition.abort();
        } catch {
          try {
            ExpoSpeechRecognition.stop();
          } catch {
            // ignore
          }
        }
        this._removeNativeListeners();
      }
    } catch (e) {
      console.error('[VoiceRecognitionService] destroy() error:', e.message);
      lastVoiceError = e.message;
    }
  }
}
