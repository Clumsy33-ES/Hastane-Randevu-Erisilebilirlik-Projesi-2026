/**
 * buildConfig.js
 *
 * Sunum / production APK ile geliştirme ortamını ayırır.
 * __DEV__ === true iken (Expo Go, dev client) mevcut STT debug sistemi korunur.
 * EAS production APK'da sunum modu aktif olur.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** EAS / production APK — mikrofon otomatik başlamaz, STT sadece Sesli Asistan + Debug */
export const isPresentationMode = () => {
  if (Platform.OS === 'web') return false;
  if (__DEV__) return false;
  const env = Constants?.executionEnvironment || '';
  return env === 'standalone' || env === 'bare';
};

/** Global STT'nin aktif olabileceği ekranlar (sunum modunda) */
export const STT_EXPERIMENTAL_SCREENS = ['voiceCommandAssistant', 'voiceDebug'];

export const isSttAllowedOnScreen = (screenName) => {
  if (!screenName) return false;
  if (!isPresentationMode()) return true;
  return STT_EXPERIMENTAL_SCREENS.includes(screenName);
};

/** TalkBack önerilen minimum dokunma alanı (dp) */
export const MIN_TOUCH_TARGET = 56;
