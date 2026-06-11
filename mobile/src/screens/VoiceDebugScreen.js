import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getTheme } from '../styles/theme';
import {
  getVoiceDebugInfo,
  requestMicrophonePermission,
} from '../utils/voiceRecognition';
import { voiceService } from '../utils/speech';
import { isPresentationMode } from '../utils/buildConfig';

const INITIAL_DEBUG_INFO = {
  platform: Platform.OS ?? 'unknown',
  executionEnvironment: 'yükleniyor...',
  isExpoGo: false,
  recognitionMode: 'yükleniyor...',
  microphonePermission: null,
  voiceAvailable: false,
  recognitionAvailable: false,
  speechServices: null,
  defaultRecognitionService: null,
  voiceEnabled: true,
  nativeModuleLoaded: false,
  nativeModuleLoadError: null,
  loadError: null,
  sttServicesError: null,
};

const formatPermission = (value) => {
  if (value === true) return 'Verildi ✓';
  if (value === false) return 'Verilmedi ✗';
  return 'Bilinmiyor';
};

const formatBool = (value) => {
  if (value === true) return 'Evet';
  if (value === false) return 'Hayır';
  return 'Bilinmiyor';
};

const formatSpeechServices = (services) => {
  if (!services) return '(okunamadı veya desteklenmiyor)';
  if (!Array.isArray(services)) return String(services);
  if (services.length === 0) return '(bulunamadı)';
  return services.join(', ');
};

export default function VoiceDebugScreen({ setScreen, accessibilitySettings, registerVoiceCallback }) {
  const theme = getTheme(accessibilitySettings ?? {});
  const { colors, fontSizes } = theme;
  const [info, setInfo] = useState(INITIAL_DEBUG_INFO);
  const [actionError, setActionError] = useState(null);

  // Live diagnostics from global STT via status listener
  const [liveDiagnostics, setLiveDiagnostics] = useState({
    listeningStatus: 'Bağlanıyor...',
    lastDetectedText: '(yok)',
    lastRawError: '(yok)',
    lastEndEventTime: '(hiç)',
  });

  const refreshInfo = useCallback(async () => {
    try {
      const data = await getVoiceDebugInfo();
      let voiceEnabled = true;
      try { voiceEnabled = voiceService?.voiceEnabled ?? true; } catch { voiceEnabled = true; }
      setInfo({ ...INITIAL_DEBUG_INFO, ...data, voiceEnabled });
      setActionError(null);
    } catch (error) {
      const msg = String(error?.message || error);
      console.error('[VoiceDebugScreen] refreshInfo failed:', msg);
      setInfo({ ...INITIAL_DEBUG_INFO, loadError: msg || 'Ses tanıma bilgileri alınamadı.', recognitionMode: 'unknown' });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Subscribe to live diagnostics from global voiceService
    const onStatus = (snap) => {
      if (!mounted) return;
      setLiveDiagnostics({
        listeningStatus: snap.listeningStatus ?? 'Bilinmiyor',
        lastDetectedText: snap.lastDetectedText ?? '(yok)',
        lastRawError: snap.lastRawError ?? '(yok)',
        lastEndEventTime: snap.lastEndEventTime ?? '(hiç)',
      });
    };
    voiceService.addStatusListener(onStatus);

    // Seed current diagnostics immediately
    onStatus(voiceService.diagnostics);

    const load = async () => {
      if (!mounted) return;
      await refreshInfo();
    };

    load();
    const interval = setInterval(() => {
      load().catch(() => {});
    }, 3000);

    if (isPresentationMode()) {
      voiceService.enableSttForExperimentalScreen(true);
    }

    // Register this screen's voice callback — commands go to global handler
    if (registerVoiceCallback) {
      registerVoiceCallback((text) => {
        console.log('[VoiceDebugScreen] Received command via global STT:', text);
        // Just log; global dispatch already handled routing in App.js
      });
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      voiceService.removeStatusListener(onStatus);
      if (registerVoiceCallback) registerVoiceCallback(null);
      if (isPresentationMode()) {
        voiceService.enableSttForExperimentalScreen(false);
      }
    };
  }, [refreshInfo]);

  const handleRequestPermission = async () => {
    try {
      setActionError(null);
      await requestMicrophonePermission();
      await refreshInfo();
    } catch (error) {
      setActionError(String(error?.message || error));
    }
  };

  const renderRow = (label, value) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted, fontSize: fontSizes.small }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text, fontSize: fontSizes.medium }]}>
        {value ?? 'Bilinmiyor'}
      </Text>
    </View>
  );

  const showLoadError = !!info?.loadError;
  const showNativeMissing = info?.nativeModuleLoaded === false;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setScreen('profile')}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <MaterialIcons name="arrow-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text, fontSize: fontSizes.xlarge }]}>
          Ses Tanıma Debug
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {showLoadError && (
          <View style={[styles.alertBox, { backgroundColor: '#fff3e0', borderColor: '#ff9800' }]}>
            <Text style={[styles.alertText, { color: '#e65100' }]}>Ses tanıma bilgileri alınamadı.</Text>
            <Text style={[styles.alertSubText, { color: '#bf360c' }]}>{info?.loadError}</Text>
          </View>
        )}
        {showNativeMissing && (
          <View style={[styles.alertBox, { backgroundColor: '#ffebee', borderColor: '#e53935' }]}>
            <Text style={[styles.alertText, { color: '#c62828' }]}>Native ses tanıma modülü yüklenemedi.</Text>
            {info?.nativeModuleLoadError ? (
              <Text style={[styles.alertSubText, { color: '#b71c1c' }]}>{info.nativeModuleLoadError}</Text>
            ) : null}
          </View>
        )}
        {actionError ? (
          <View style={[styles.alertBox, { backgroundColor: '#ffebee', borderColor: '#e53935' }]}>
            <Text style={[styles.alertText, { color: '#c62828' }]}>{actionError}</Text>
          </View>
        ) : null}

        {/* System Info */}
        {renderRow('Platform', info?.platform ?? 'Bilinmiyor')}
        {renderRow('Execution Environment', info?.executionEnvironment ?? 'Bilinmiyor')}
        {renderRow('Expo Go', formatBool(info?.isExpoGo))}
        {renderRow('Tanıma Modu', info?.recognitionMode ?? 'Bilinmiyor')}
        {renderRow('Mikrofon İzni', formatPermission(info?.microphonePermission))}
        {renderRow('Native Modül Yüklü', formatBool(info?.nativeModuleLoaded))}
        {renderRow('Ses Tanıma Kullanılabilir', formatBool(info?.voiceAvailable))}
        {renderRow('Recognition Available', formatBool(info?.recognitionAvailable))}
        {renderRow('Sesli Asistan Açık', formatBool(info?.voiceEnabled))}

        {Platform.OS === 'android' && renderRow('Android STT Servisleri', formatSpeechServices(info?.speechServices))}
        {Platform.OS === 'android' && renderRow('Varsayılan STT Servisi', info?.defaultRecognitionService || '(okunamadı veya desteklenmiyor)')}
        {info?.sttServicesError ? renderRow('STT Servis Hatası', info.sttServicesError) : null}

        {/* Live Diagnostics from Global STT */}
        <View style={[styles.liveBox, { borderColor: colors.primary }]}>
          <Text style={[styles.liveTitle, { color: colors.primary }]}>
            🎙 Global STT — Canlı Durum
          </Text>
          {renderRow('Dinleme Durumu', liveDiagnostics.listeningStatus)}
          {renderRow('Son Algılanan Metin', liveDiagnostics.lastDetectedText)}
          {renderRow('Son Hata', liveDiagnostics.lastRawError)}
          {renderRow('Son End Event Zamanı', liveDiagnostics.lastEndEventTime)}
        </View>

        <Text style={[styles.hint, { color: colors.muted, fontSize: fontSizes.small }]}>
          Global STT App.js seviyesinde çalışıyor. Bu ekranda "randevu al", "ana sayfa", "aile hekimi" diyerek komutları test edebilirsiniz.
          Mod: {info?.recognitionMode ?? 'Bilinmiyor'}. APK ortamında "native" görünmelidir.
        </Text>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleRequestPermission}
          accessibilityRole="button"
          accessibilityLabel="Mikrofon izni iste"
        >
          <MaterialIcons name="mic" size={22} color="#fff" />
          <Text style={styles.btnText}>Mikrofon İzni İste / Yenile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  title: { fontWeight: 'bold' },
  container: { padding: 20, gap: 12 },
  alertBox: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  alertText: { fontWeight: 'bold', fontSize: 15 },
  alertSubText: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  label: { fontWeight: '600', marginBottom: 2 },
  value: { lineHeight: 22 },
  liveBox: {
    marginTop: 16,
    padding: 12,
    borderWidth: 2,
    borderRadius: 12,
  },
  liveTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  hint: { marginTop: 16, lineHeight: 20 },
});
