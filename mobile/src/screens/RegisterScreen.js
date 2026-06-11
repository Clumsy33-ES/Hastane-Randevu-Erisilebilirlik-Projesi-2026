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

export default function RegisterScreen({ setScreen, accessibilitySettings }) {
  const [fullName, setFullName] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  useEffect(() => {
    voiceService.setScreen('register');
    if (accessibilitySettings?.voiceGuide) {
      voiceService.speak('Kayıt ekranındasınız. Hesap oluşturmak için formu doldurun.');
    }
    return () => {
      voiceService.stopListening();
    };
  }, []);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Ad Soyad alanı boş bırakılamaz.');
      return;
    }
    if (!tcNo || tcNo.trim().length !== 11) {
      Alert.alert('Hata', 'TC Kimlik numarası 11 haneli olmalıdır.');
      return;
    }
    if (!password || password.length < 4) {
      Alert.alert('Hata', 'Şifre en az 4 karakterden oluşmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/register', {
        tc_no: tcNo.trim(),
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        password: password,
      });

      const { success, message, detail } = response.data;

      if (response.status === 200 || response.status === 201 || success) {
        const successMsg = 'Kayıt başarılı. Giriş ekranına yönlendiriliyorsunuz.';
        Alert.alert('Başarılı', successMsg);
        if (accessibilitySettings?.voiceGuide) {
          voiceService.speak(successMsg);
        }
        
        // Formu temizle
        setFullName('');
        setTcNo('');
        setPhone('');
        setPassword('');
        
        // Kısa bir süre sonra yönlendir
        setTimeout(() => {
          setScreen('login');
        }, 1500);
      } else {
        const errorMsg = detail || message || 'Kayıt sırasında hata oluştu. Lütfen bilgilerinizi kontrol ediniz.';
        Alert.alert('Kayıt Başarısız', errorMsg);
        if (accessibilitySettings?.voiceGuide) {
          voiceService.speak(errorMsg);
        }
      }
    } catch (error) {
      console.error('[Register Error]', error);
      const errorMsg = error.response?.data?.detail || 'Kayıt sırasında hata oluştu. Lütfen bilgilerinizi kontrol ediniz.';
      
      if (error.response?.status === 400 && typeof errorMsg === 'string' && errorMsg.includes('zaten var')) {
        const existMsg = 'Bu TC ile kayıtlı kullanıcı var. Lütfen giriş yapın.';
        Alert.alert('Kayıt Başarısız', existMsg, [
          { text: 'Giriş Yap', onPress: () => setScreen('login') },
          { text: 'İptal', style: 'cancel' }
        ]);
        if (accessibilitySettings?.voiceGuide) {
          voiceService.speak(existMsg);
        }
      } else {
        Alert.alert('Kayıt Başarısız', errorMsg);
        if (accessibilitySettings?.voiceGuide) {
          voiceService.speak(errorMsg);
        }
      }
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
              Yeni Hesap Oluştur
            </Text>
          </View>

          {/* Main Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card }]}>
            <Text style={[styles.title, { color: colors.text, fontSize: fontSizes.xlarge }]} accessibilityRole="header">
              Kayıt Ol
            </Text>
            <Text style={[styles.description, { color: colors.muted, fontSize: fontSizes.small }]}>
              Sağlık randevularınızı almak için aşağıdaki formu eksiksiz doldurun.
            </Text>

            {/* Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text, fontSize: fontSizes.medium }]}>
                Ad Soyad
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.medium }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Adınız ve soyadınız"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                accessibilityLabel="Ad soyad giriş alanı"
                accessibilityHint="Adınızı ve soyadınızı girmek için iki kez dokunun"
              />
            </View>

            {/* TC Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text, fontSize: fontSizes.medium }]}>
                T.C. Kimlik No
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.medium }]}
                value={tcNo}
                onChangeText={setTcNo}
                placeholder="11 haneli kimlik numaranız"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={11}
                accessibilityLabel="TC kimlik numarası giriş alanı"
                accessibilityHint="T.C. Kimlik numaranızı girmek için iki kez dokunun"
              />
            </View>

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text, fontSize: fontSizes.medium }]}>
                Telefon Numarası
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, fontSize: fontSizes.medium }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="05xxxxxxxxx"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                maxLength={11}
                accessibilityLabel="Telefon numarası giriş alanı"
                accessibilityHint="Telefon numaranızı girmek için iki kez dokunun"
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
                placeholder="Şifrenizi belirleyin"
                placeholderTextColor={colors.muted}
                secureTextEntry
                accessibilityLabel="Şifre giriş alanı"
                accessibilityHint="Güvenli şifrenizi girmek için iki kez dokunun"
              />
            </View>

            {/* Register Submit Button */}
            <AccessibleButton
              title="Kayıt Ol"
              onPress={handleRegister}
              loading={loading}
              accessibilityLabel="Kayıt işlemini tamamla ve kaydol"
              accessibilityHint="Kaydı tamamlamak için çift tıklayın"
              style={[styles.registerBtn, { backgroundColor: colors.primary }]}
              textStyle={{ fontSize: fontSizes.large }}
            />

            {/* Cancel / Go back to login */}
            <AccessibleButton
              title="Vazgeç / Giriş Ekranı"
              onPress={() => setScreen('login')}
              accessibilityLabel="Kayıt işleminden vazgeç ve giriş ekranına dön"
              accessibilityHint="Giriş ekranına dönmek için çift tıklayın"
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              textStyle={[styles.cancelBtnText, { color: colors.primary, fontSize: fontSizes.large }]}
            />
          </View>

          {/* Guide Helper */}
          <View style={[styles.guideContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.guideText, { color: colors.text, fontSize: fontSizes.small }]}>
              💡 <Text style={{ fontWeight: 'bold' }}>Akıllı Rehber:</Text> Bilgilerinizi doğru ve eksiksiz doldurmanız hastane işlemlerinizin sorunsuz yürümesini sağlar. T.C. kimlik numaranız başka bir hesapta kayıtlı olmamalıdır.
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
    marginBottom: 20,
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
    height: 54,
    borderWidth: 1.5,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  registerBtn: {
    marginTop: 12,
  },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    elevation: 0,
    shadowOpacity: 0,
  },
  cancelBtnText: {
    fontWeight: 'bold',
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
