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
import { colors } from './src/styles/theme';
import { Platform } from 'react-native';
import { voiceService } from './src/utils/speech';
import { detectRecognitionMode, requestMicrophonePermission, checkMicrophonePermission } from './src/utils/voiceRecognition';
import { MaterialIcons } from '@expo/vector-icons';

export default function App() {
  const [screen, setScreen] = useState(null); // null denotes initial load check
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(voiceService.voiceEnabled);
  const [accessibilitySettings, setAccessibilitySettingsState] = useState({
    largeText: false,
    highContrast: false,
    voiceGuide: false,
  });

  // Load configuration settings from AsyncStorage on startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Auth token check
        const token = await AsyncStorage.getItem('token');
        
        // Load settings values
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
    
    // Check permissions on native platforms without prompting every time
    if (Platform.OS !== 'web' && screen !== 'login' && screen !== 'register' && screen !== 'forgotPassword' && screen !== null) {
      checkMicrophonePermission().then((hasPermission) => {
        console.log('[App] Current Microphone permission:', hasPermission);
        if (!hasPermission && isVoiceEnabled) {
          console.log('[App] Microphone denied but voice is enabled. Disabling voice.');
          voiceService.setVoiceEnabled(false);
        }
      });
    }

    return () => {
      voiceService.cleanup();
    };
  }, [screen]);

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
        />
      )}
      {screen === 'myAppointments' && (
        <MyAppointmentsScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
        />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
          setAccessibilitySettings={setAccessibilitySettings}
        />
      )}
      {screen === 'appointment' && (
        <AppointmentScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
        />
      )}
      {screen === 'familyPhysician' && (
        <FamilyPhysicianScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
        />
      )}
      {screen === 'voiceCommandAssistant' && (
        <VoiceCommandAssistantScreen
          setScreen={setScreen}
          accessibilitySettings={accessibilitySettings}
        />
      )}

      {!isVoiceEnabled && screen !== 'login' && screen !== 'register' && screen !== 'forgotPassword' && screen !== null && (
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
