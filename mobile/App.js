import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert, TouchableOpacity, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import MyAppointmentsScreen from './src/screens/MyAppointmentsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AppointmentScreen from './src/screens/AppointmentScreen';
import FamilyPhysicianScreen from './src/screens/FamilyPhysicianScreen';
import VoiceCommandAssistantScreen from './src/screens/VoiceCommandAssistantScreen';
import VoiceDebugScreen from './src/screens/VoiceDebugScreen';
import { colors } from './src/styles/theme';
import { Platform } from 'react-native';
import { voiceService } from './src/utils/speech';
import { requestMicrophonePermission } from './src/utils/voiceRecognition';
import { isPresentationMode, isSttAllowedOnScreen } from './src/utils/buildConfig';
import { MaterialIcons } from '@expo/vector-icons';

export default function App() {
  const [screen, setScreen] = useState(null); // null denotes initial load check
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(voiceService.voiceEnabled);
  const [accessibilitySettings, setAccessibilitySettingsState] = useState({
    largeText: false,
    highContrast: false,
    voiceGuide: false,
  });

  // Refs for global STT dispatcher (avoid stale closures)
  const screenRef = React.useRef(screen);
  const screenVoiceCallbackRef = React.useRef(null); // Registered by active screen
  const lastCommandTextRef = React.useRef('');
  const lastCommandTimeRef = React.useRef(0);

  // Keep screenRef in sync
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Allow screens to register their own voice handler
  const registerVoiceCallback = React.useCallback((fn) => {
    screenVoiceCallbackRef.current = fn;
  }, []);

  // Central voice input dispatcher
  const handleGlobalVoiceInput = React.useCallback((text) => {
    if (!text || !text.trim()) return;

    // 1.5s cooldown for same command
    const now = Date.now();
    const normText = text.toLowerCase().trim().replace(/[.,!?]/g, '');
    if (normText === lastCommandTextRef.current && (now - lastCommandTimeRef.current) < 1500) {
      console.log('[App] Cooldown: ignoring duplicate command:', normText);
      return;
    }
    lastCommandTextRef.current = normText;
    lastCommandTimeRef.current = now;

    console.log('[App] Global voice input:', text, '| Screen:', screenRef.current);

    // Route via global command handler (randevu al, ana sayfa, vb.)
    const handled = voiceService.handleGlobalCommand(text, setScreen);
    if (handled) return;

    // Delegate to the currently active screen's handler
    if (typeof screenVoiceCallbackRef.current === 'function') {
      screenVoiceCallbackRef.current(text);
    }
  }, []);

  // Load configuration settings from AsyncStorage on startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const largeTextVal = await AsyncStorage.getItem('largeText');
        const highContrastVal = await AsyncStorage.getItem('highContrast');
        const voiceGuideVal = await AsyncStorage.getItem('voiceGuide');

        setAccessibilitySettingsState({
          largeText: largeTextVal === 'true',
          highContrast: highContrastVal === 'true',
          voiceGuide: voiceGuideVal === 'true',
        });

        if (token) {
          setScreen('home');
        } else {
          setScreen('login');
        }
      } catch (e) {
        console.error('[App Init] Error loading auth or settings:', e);
        setScreen('login');
      }
    };
    initializeApp();
  }, []);

  // Sync local state with global VoiceService voiceEnabled
  useEffect(() => {
    voiceService.onVoiceEnabledChange = (enabled) => {
      setIsVoiceEnabled(enabled);
    };
    return () => {
      voiceService.onVoiceEnabledChange = null;
    };
  }, []);

  // Global STT:
  // - Dev: tüm oturum açık ekranlarda
  // - Production APK (sunum): yalnızca Sesli Asistan + Debug ekranlarında
  const AUTH_SCREENS = ['login', 'register', 'forgotPassword'];
  useEffect(() => {
    if (screen === null) return;
    const isAuthScreen = AUTH_SCREENS.includes(screen);
    const sttAllowed = isSttAllowedOnScreen(screen);

    if (!isAuthScreen && isVoiceEnabled && sttAllowed) {
      console.log('[App] Starting global STT listener | screen:', screen);
      voiceService.startListening(
        (text) => handleGlobalVoiceInput(text),
        () => {},
        (err) => console.log('[App] Global STT error:', err),
        () => console.log('[App] Global STT started'),
        { screenName: screen }
      );
    } else {
      console.log('[App] Stopping global STT | auth:', isAuthScreen, '| allowed:', sttAllowed);
      voiceService.stopListening();
    }

    return () => {};
  }, [isVoiceEnabled, screen]);

  // App teardown cleanup only (logout/exit)
  useEffect(() => {
    return () => {
      voiceService.cleanup();
    };
  }, []);


  // Update and save accessibility settings
  const setAccessibilitySettings = async (newSettings) => {
    try {
      setAccessibilitySettingsState(newSettings);
      await AsyncStorage.setItem('largeText', String(newSettings.largeText));
      await AsyncStorage.setItem('highContrast', String(newSettings.highContrast));
      await AsyncStorage.setItem('voiceGuide', String(newSettings.voiceGuide));
    } catch (e) {
      console.error('[App Settings] Error writing settings to AsyncStorage:', e);
    }
  };

  if (screen === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {screen === 'login' && (
        <LoginScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
        />
      )}
      {screen === 'register' && (
        <RegisterScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
        />
      )}
      {screen === 'forgotPassword' && (
        <ForgotPasswordScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
        />
      )}
      {screen === 'home' && (
        <HomeScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          registerVoiceCallback={registerVoiceCallback}
        />
      )}
      {screen === 'myAppointments' && (
        <MyAppointmentsScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          registerVoiceCallback={registerVoiceCallback}
        />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          setAccessibilitySettings={setAccessibilitySettings}
          registerVoiceCallback={registerVoiceCallback}
        />
      )}
      {screen === 'appointment' && (
        <AppointmentScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          registerVoiceCallback={registerVoiceCallback}
        />
      )}
      {screen === 'familyPhysician' && (
        <FamilyPhysicianScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          registerVoiceCallback={registerVoiceCallback}
        />
      )}
      {screen === 'voiceCommandAssistant' && (
        <VoiceCommandAssistantScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          registerVoiceCallback={registerVoiceCallback}
        />
      )}
      {screen === 'voiceDebug' && (
        <VoiceDebugScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          registerVoiceCallback={registerVoiceCallback}
        />
      )}

      {!isPresentationMode() && !isVoiceEnabled && screen !== 'login' && screen !== 'register' && screen !== 'forgotPassword' && screen !== null && (
        <View style={styles.floatingButtonContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.floatingButton}
            accessibilityRole="button"
            accessibilityLabel="Sesli Asistanı Aç"
            accessibilityHint="Kapalı olan sesli asistan mikrofonunu yeniden aktif hale getirir"
            onPress={async () => {
              if (Platform.OS !== 'web') {
                const granted = await requestMicrophonePermission();
                if (granted) {
                  voiceService.setVoiceEnabled(true);
                } else {
                  Alert.alert('İzin Reddedildi', 'Mikrofon erişimi kapalı. Ayarlardan etkinleştirebilirsiniz.');
                }
              } else {
                voiceService.setVoiceEnabled(true);
              }
            }}
          >
            <MaterialIcons name="mic" size={32} color="#ffffff" />
            <Text style={styles.floatingButtonText}>Sesli Asistanı Aç</Text>
          </TouchableOpacity>
        </View>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e53935', // Red theme for prominent visibility
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  floatingButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
