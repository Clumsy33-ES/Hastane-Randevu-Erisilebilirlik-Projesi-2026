import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/api';
import { getTheme, radius } from '../styles/theme';
import AccessibleButton from '../components/AccessibleButton';
import { voiceService } from '../utils/speech';

export default function LoginScreen({ setScreen, accessibilitySettings }) {
  const [tc, setTc] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  useEffect(() => {
    voiceService.setScreen('login');
    if (accessibilitySettings?.voiceGuide) {
      voiceService.speak('Giriş ekranındasınız. TC kimlik numaranızı girmek için ilk alana, şifrenizi girmek için ikinci alana dokunabilirsiniz. TalkBack veya VoiceOver kullanıyorsanız alanlar sesli okunacaktır.');
    }
    return () => {
      voiceService.stopListening();
    };
  }, []);

  const handleLogin = async () => {
    if (!tc || tc.trim().length !== 11) {
      Alert.alert('Hata', 'TC Kimlik numarası 11 haneli olmalıdır.');
      return;
    }
    if (!password) {
      Alert.alert('Hata', 'Lütfen şifrenizi girin.');
      return;
    }

    setLoading(true);
    try {
      // Backend expects 'tc' and 'password' in LoginRequest
      const response = await apiClient.post('/auth/login', {
        tc: tc.trim(),
        password: password,
      });

      const { success, access_token, role, user, detail } = response.data;

      if (success && access_token) {
        await AsyncStorage.setItem('token', access_token);
        await AsyncStorage.setItem('role', role || 'user');
        if (user) {
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
        setScreen('home');
      } else {
        Alert.alert('Giriş Başarısız', 'TC Kimlik No veya şifre hatalı.');
      }
    } catch (error) {
      console.error('[Login Error]', error);
      Alert.alert('Giriş Başarısız', 'TC Kimlik No veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Header Logo */}
          <View style={styles.headerContainer} accessibilityRole="header">
            <Text style={[styles.logoText, { color: colors.primary }]}>🏥 Erişimli Randevu</Text>
            <Text style={[styles.subtitleText, { color: colors.text, fontSize: fontSizes.medium }]}>
              Engelsiz ve Kolay Randevu
            </Text>
          </View>

          {/* Main Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card }]}>
            <Text style={[styles.title, { color: colors.text, fontSize: fontSizes.xlarge }]} accessibilityRole="header">
              Giriş Yap
            </Text>
            <Text style={[styles.description, { color: colors.muted, fontSize: fontSizes.small }]}>
              T.C. Kimlik numaranızı ve şifrenizi girerek sisteme erişebilirsiniz.
            </Text>

            {/* TC Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text, fontSize: fontSizes.medium }]}>
                T.C. Kimlik No
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.medium }]}
                value={tc}
                onChangeText={setTc}
                placeholder="11 haneli kimlik numaranız"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={11}
                accessibilityLabel="TC Kimlik Numarası"
                accessibilityHint="On bir haneli TC kimlik numaranızı girin"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text, fontSize: fontSizes.medium }]}>
                Şifre
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.medium }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Şifreniz"
                placeholderTextColor={colors.muted}
                secureTextEntry={true}
                accessibilityLabel="Şifre"
                accessibilityHint="Şifrenizi girin"
              />
            </View>

            {/* Login Button */}
            <AccessibleButton
              title="Giriş Yap"
              onPress={handleLogin}
              loading={loading}
              accessibilityLabel="Giriş Yap"
              accessibilityHint="Bilgileriniz doğruysa ana sayfaya geçer"
              style={[styles.loginBtn, { backgroundColor: colors.primary }]}
              textStyle={{ fontSize: fontSizes.large }}
            />

            {/* Register Navigation Button */}
            <AccessibleButton
              title="Kayıt Ol"
              onPress={() => setScreen('register')}
              accessibilityLabel="Kayıt ol ekranına git"
              accessibilityHint="Kayıt sayfasına geçmek için çift tıklayın"
              style={[styles.registerBtn, { borderColor: colors.border }]}
              textStyle={[styles.registerBtnText, { color: colors.primary, fontSize: fontSizes.large }]}
            />

            <AccessibleButton
              title="Şifremi Unuttum?"
              onPress={() => setScreen('forgotPassword')}
              accessibilityLabel="Şifremi unuttum"
              accessibilityHint="Şifrenizi sıfırlamak için çift tıklayın"
              style={[styles.forgotBtn, { borderColor: 'transparent', backgroundColor: 'transparent' }]}
              textStyle={[styles.forgotBtnText, { color: colors.primary, fontSize: fontSizes.medium }]}
            />

            {/* Biometric Login (Placeholder) */}
            {/* MİMARİ NOT: İlerleyen sürümde yüz tanıma/parmak izi ile biyometrik giriş desteği eklenecektir. */}
            <View style={{ marginTop: 24 }}>
              <AccessibleButton
                title="Biyometrik Giriş — Yakında"
                onPress={() => {}}
                accessibilityLabel="Biyometrik giriş yakında eklenecektir"
                style={[{ backgroundColor: colors.muted, opacity: 0.6 }]}
                textStyle={{ fontSize: fontSizes.medium }}
              />
            </View>
          </View>

          {/* Guide Alert/Tip */}
          <View style={[styles.guideContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.guideText, { color: colors.text, fontSize: fontSizes.small }]}>
              💡 <Text style={{ fontWeight: 'bold' }}>Akıllı Rehber:</Text> Ekran okuyucu kullanıyorsanız giriş alanlarını doldurarak Giriş Yap butonuna basın. Hesabınız yoksa Kayıt Ol butonuna basarak yeni hesap açabilirsiniz.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitleText: {
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 54, // Accessible input touch target
    borderWidth: 1.5,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  loginBtn: {
    marginTop: 12,
  },
  registerBtn: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    elevation: 0,
    shadowOpacity: 0,
  },
  registerBtnText: {
    fontWeight: 'bold',
  },
  forgotBtn: {
    marginTop: 8,
    paddingVertical: 8,
    elevation: 0,
    shadowOpacity: 0,
  },
  forgotBtnText: {
    textDecorationLine: 'underline',
  },
  guideContainer: {
    marginTop: 20,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
  },
  guideText: {
    lineHeight: 20,
  },
});
