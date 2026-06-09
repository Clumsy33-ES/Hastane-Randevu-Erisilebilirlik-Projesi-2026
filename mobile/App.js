import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import MyAppointmentsScreen from './src/screens/MyAppointmentsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AppointmentScreen from './src/screens/AppointmentScreen';
import FamilyPhysicianScreen from './src/screens/FamilyPhysicianScreen';
import VoiceCommandAssistantScreen from './src/screens/VoiceCommandAssistantScreen';
import { colors } from './src/styles/theme';
import { Platform } from 'react-native';
import { voiceService } from './src/utils/speech';
import { detectRecognitionMode, requestMicrophonePermission } from './src/utils/voiceRecognition';

export default function App() {
  const [screen, setScreen] = useState(null); // null denotes initial load check
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

  // Global voice command controller
  useEffect(() => {
    if (screen === 'login' || screen === 'register' || screen === null) {
      voiceService.cleanup();
      return;
    }

    // Let VoiceCommandAssistantScreen handle its own step-by-step logic
    if (screen === 'voiceCommandAssistant' || screen === 'appointment') {
      return;
    }

    // Request permissions on native platforms
    if (Platform.OS !== 'web') {
      requestMicrophonePermission().then((hasPermission) => {
        console.log('[App] Microphone permission:', hasPermission);
      });
    }

    console.log('[App] Initializing global voice recognition listener on screen:', screen);

    voiceService.startListening(
      async (text) => {
        const norm = text.toLowerCase().trim();
        console.log('[Global Voice Command Received]:', text);

        if (norm.includes('randevu al') || norm.includes('hastane randevusu') || norm.includes('randevu almak istiyorum')) {
          setScreen('appointment');
          voiceService.speak('Hastane randevusu ekranına yönlendiriliyorsunuz.', null, true);
        } else if (norm.includes('randevularım') || norm.includes('randevular')) {
          setScreen('myAppointments');
          voiceService.speak('Randevularım ekranına yönlendiriliyorsunuz.', null, true);
        } else if (norm.includes('aile hekimi')) {
          setScreen('familyPhysician');
          voiceService.speak('Aile hekimi ekranına yönlendiriliyorsunuz.', null, true);
        } else if (norm.includes('profil') || norm.includes('ayarlar')) {
          setScreen('profile');
          voiceService.speak('Profil ve ayarlar ekranına yönlendiriliyorsunuz.', null, true);
        } else if (norm.includes('çıkış') || norm.includes('çıkış yap')) {
          try {
            voiceService.cleanup();
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('role');
            await AsyncStorage.removeItem('user');
            setScreen('login');
            voiceService.speak('Oturum kapatıldı.', null, true);
          } catch (e) {
            console.error('[Global Logout Error]', e);
          }
        } else if (norm.includes('geri') || norm.includes('geri dön') || norm.includes('geri git') || norm.includes('ana sayfa') || norm.includes('iptal')) {
          setScreen('home');
          voiceService.speak('Ana sayfaya dönülüyor.', null, true);
        }
      },
      () => {},
      (err) => console.log('[Global STT Error]', err),
      () => console.log('[Global STT Started]')
    );

    return () => {
      // Cleanup global listener on screen change or unmount
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
});
