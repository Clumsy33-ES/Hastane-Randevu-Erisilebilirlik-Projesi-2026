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
import apiClient from '../api/api';
import { getTheme, radius } from '../styles/theme';
import AccessibleButton from '../components/AccessibleButton';
import { voiceService } from '../utils/speech';
import { isPresentationMode } from '../utils/buildConfig';

export default function ForgotPasswordScreen({ setScreen, accessibilitySettings }) {
  const [step, setStep] = useState('tc'); // 'tc', 'code', 'newPassword'
  const [tc, setTc] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  useEffect(() => {
    voiceService.setScreen('forgotPassword');
    
    // Configure voice listener based on the step
    const startStepListener = () => {
      voiceService.startListening(
        (text) => {
          const norm = text.toLowerCase().trim();
          console.log(`[ForgotPassword Voice - Step ${step}] Received:`, norm);
          
          if (voiceService.handleGlobalCommand(norm, setScreen)) return;

          if (step === 'tc') {
            const digits = norm.replace(/\D/g, '');
            if (digits.length === 11) {
              setTc(digits);
              voiceService.speak(`${digits} numaralı TC kimlik numarası algılandı. Onaylıyorsanız devam deyin, yanlışsa tekrar söyleyin.`);
            } else if (norm.includes('devam') && tc.length === 11) {
              handleSendCode();
            } else {
              voiceService.speak("Geçerli bir TC kimlik numarası algılanamadı. Lütfen 11 haneli TC kimlik numaranızı söyleyin.");
            }
          } else if (step === 'code') {
            const digits = norm.replace(/\D/g, '');
            if (digits.length === 6) {
              setCode(digits);
              voiceService.speak(`${digits} doğrulama kodu algılandı. Onaylıyorsanız devam deyin.`);
            } else if (norm.includes('devam') && code.length === 6) {
              setStep('newPassword');
              voiceService.speak("Lütfen yeni şifrenizi söyleyin.");
            } else {
              voiceService.speak("Lütfen 6 haneli doğrulama kodunuzu söyleyin.");
            }
          } else if (step === 'newPassword') {
            if (norm.includes('devam') && newPassword.length >= 4) {
              handleResetPassword();
            } else if (norm.length >= 4) {
              // Convert text like "bir iki üç dört" to digits if possible, but for simplicity we just take the word
              setNewPassword(norm.replace(/\s/g, ''));
              voiceService.speak(`Yeni şifreniz algılandı. Kaydetmek için devam deyin.`);
            } else {
              voiceService.speak("Lütfen en az 4 karakterli yeni şifrenizi söyleyin.");
            }
          }
        },
        () => {},
        (err) => console.log('[ForgotPassword STT Error]', err),
        () => console.log('[ForgotPassword STT Started]')
      );
    };

    if (accessibilitySettings?.voiceGuide) {
      if (step === 'tc') {
        voiceService.speak('Şifremi unuttum ekranındasınız. Lütfen 11 haneli TC kimlik numaranızı girin veya söyleyin.');
      } else if (step === 'code') {
        voiceService.speak('Telefonunuza gönderilen 6 haneli doğrulama kodunu girin veya söyleyin.');
      } else if (step === 'newPassword') {
        voiceService.speak('Lütfen en az 4 karakterden oluşan yeni şifrenizi girin veya söyleyin.');
      }
    }

    if (!isPresentationMode()) {
      startStepListener();
    }

    return () => {
      voiceService.stopListening();
    };
  }, [step, tc, code, newPassword]); // Re-run when state changes so the voice handler has latest state

  const handleSendCode = async () => {
    if (!tc || tc.trim().length !== 11) {
      Alert.alert('Hata', 'TC Kimlik numarası 11 haneli olmalıdır.');
      voiceService.speak('TC Kimlik numarası 11 haneli olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/forgot-password', {
        tc_identity_number: tc.trim()
      });
      if (response.data.success) {
        Alert.alert('Başarılı', response.data.message);
        setStep('code');
      }
    } catch (error) {
      console.error('[Forgot Password Error]', error);
      const errorMsg = error.response?.data?.detail || 'Bir hata oluştu.';
      Alert.alert('Hata', errorMsg);
      if (accessibilitySettings?.voiceGuide) voiceService.speak(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || code.trim().length !== 6) {
      Alert.alert('Hata', 'Doğrulama kodu 6 haneli olmalıdır.');
      voiceService.speak('Doğrulama kodu 6 haneli olmalıdır.');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      Alert.alert('Hata', 'Yeni şifreniz en az 4 karakter olmalıdır.');
      voiceService.speak('Yeni şifreniz en az 4 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/reset-password', {
        tc_identity_number: tc.trim(),
        verification_code: code.trim(),
        new_password: newPassword
      });
      if (response.data.success) {
        Alert.alert('Başarılı', response.data.message, [
          { text: 'Tamam', onPress: () => setScreen('login') }
        ]);
        if (accessibilitySettings?.voiceGuide) {
          voiceService.speak(response.data.message);
        }
      }
    } catch (error) {
      console.error('[Reset Password Error]', error);
      const errorMsg = error.response?.data?.detail || 'Bir hata oluştu.';
      Alert.alert('Hata', errorMsg);
      if (accessibilitySettings?.voiceGuide) voiceService.speak(errorMsg);
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
          <View style={styles.headerContainer} accessibilityRole="header">
            <Text style={[styles.logoText, { color: colors.primary }]}>🏥 Erişimli Randevu</Text>
            <Text style={[styles.subtitleText, { color: colors.text, fontSize: fontSizes.medium }]}>
              Şifremi Unuttum
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card }]}>
            {step === 'tc' && (
              <>
                <Text style={[styles.title, { color: colors.text, fontSize: fontSizes.large }]}>
                  TC Kimlik Numaranız
                </Text>
                <Text style={[styles.description, { color: colors.muted, fontSize: fontSizes.small }]}>
                  Hesabınıza kayıtlı TC kimlik numaranızı giriniz. Doğrulama kodu gönderilecektir.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text, fontSize: fontSizes.medium }]} accessibilityElementsHidden={true}>
                    T.C. Kimlik No
                  </Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.large }]}
                    placeholder="11 haneli TC No girin"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    maxLength={11}
                    value={tc}
                    onChangeText={setTc}
                    accessibilityLabel="T.C. Kimlik No giriş alanı"
                    accessibilityHint="11 haneli kimlik numaranızı girin"
                  />
                </View>

                <AccessibleButton
                  title={loading ? "Gönderiliyor..." : "Kod Gönder"}
                  onPress={handleSendCode}
                  disabled={loading}
                  accessibilityLabel="Doğrulama kodu gönder"
                  accessibilityHint="Doğrulama kodu göndermek için çift tıklayın"
                  style={styles.actionBtn}
                />
              </>
            )}

            {step === 'code' && (
              <>
                <Text style={[styles.title, { color: colors.text, fontSize: fontSizes.large }]}>
                  Doğrulama Kodu
                </Text>
                <Text style={[styles.description, { color: colors.muted, fontSize: fontSizes.small }]}>
                  Telefonunuza gönderilen 6 haneli doğrulama kodunu giriniz.
                </Text>

                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.large }]}
                    placeholder="6 Haneli Kod"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                    accessibilityLabel="Doğrulama kodu giriş alanı"
                  />
                </View>

                <AccessibleButton
                  title="Devam Et"
                  onPress={() => setStep('newPassword')}
                  accessibilityLabel="Devam et"
                  style={styles.actionBtn}
                />
              </>
            )}

            {step === 'newPassword' && (
              <>
                <Text style={[styles.title, { color: colors.text, fontSize: fontSizes.large }]}>
                  Yeni Şifre
                </Text>
                <Text style={[styles.description, { color: colors.muted, fontSize: fontSizes.small }]}>
                  Lütfen hesabınız için yeni şifrenizi belirleyin.
                </Text>

                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.large }]}
                    placeholder="Yeni Şifre"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={true}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    accessibilityLabel="Yeni şifre giriş alanı"
                  />
                </View>

                <AccessibleButton
                  title={loading ? "Kaydediliyor..." : "Şifreyi Güncelle"}
                  onPress={handleResetPassword}
                  disabled={loading}
                  accessibilityLabel="Şifreyi güncelle"
                  style={styles.actionBtn}
                />
              </>
            )}

            <AccessibleButton
              title="Geri Dön"
              onPress={() => setScreen('login')}
              accessibilityLabel="Giriş ekranına geri dön"
              style={[styles.backBtn, { borderColor: 'transparent', backgroundColor: 'transparent' }]}
              textStyle={{ color: colors.primary, textDecorationLine: 'underline' }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  logoText: { fontSize: 32, fontWeight: 'bold' },
  subtitleText: { marginTop: 4, fontWeight: '500' },
  card: {
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: { fontWeight: 'bold', marginBottom: 8 },
  description: { marginBottom: 20, lineHeight: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontWeight: '600', marginBottom: 8 },
  input: {
    height: 54,
    borderWidth: 1.5,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  actionBtn: { marginTop: 12 },
  backBtn: { marginTop: 16, paddingVertical: 8, elevation: 0, shadowOpacity: 0 },
});
