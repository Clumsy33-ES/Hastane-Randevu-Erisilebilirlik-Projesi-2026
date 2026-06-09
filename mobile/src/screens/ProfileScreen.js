import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { getTheme, radius } from '../styles/theme';
import { voiceService } from '../utils/speech';

export default function ProfileScreen({
  setScreen,
  accessibilitySettings,
  setAccessibilitySettings,
}) {
  const [user, setUser] = useState(null);
  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        console.error('[Profile] Error reading user data:', e);
      }
    };
    fetchUser();

    voiceService.setScreen('profile');
    if (accessibilitySettings?.voiceGuide) {
      voiceService.speak('Profil ve ayarlar ekranındasınız.');
    }

    return () => {
      voiceService.cleanup();
    };
  }, []);

  const handleToggle = (key) => {
    const nextVal = !accessibilitySettings[key];
    setAccessibilitySettings({
      ...accessibilitySettings,
      [key]: nextVal,
    });

    if (key === 'voiceGuide' && nextVal) {
      setTimeout(() => voiceService.speak('Sesli rehber aktif edildi.', null, true), 300);
    }
  };

  const handleLogout = async () => {
    console.log('[ProfileScreen] handleLogout initiated');
    try {
      voiceService.cleanup();
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('role');
      await AsyncStorage.removeItem('user');
      setScreen('login');
    } catch (e) {
      console.error('[Logout Error]', e);
    }
  };

  if (!user) return null;

  const maskedTc = user.tc
    ? `${user.tc.substring(0, 3)}*****${user.tc.substring(user.tc.length - 3)}`
    : '';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header navigation bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setScreen('home')}
            accessibilityRole="button"
            accessibilityLabel="Geri git"
            accessibilityHint="Ana sayfaya döner"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text, fontSize: fontSizes.large }]}>
              Geri
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.titleText, { color: colors.text, fontSize: fontSizes.xxlarge }]}>
            Profil ve Ayarlar
          </Text>
          <Text style={[styles.subtitleText, { color: colors.muted, fontSize: fontSizes.medium }]}>
            Hesap bilgilerinizi görüntüleyin ve erişilebilirlik ayarlarınızı düzenleyin.
          </Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card }]}>
          <View style={[styles.avatarRow, { borderBottomColor: colors.border }]}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.avatarLetter, { color: colors.primary, fontSize: fontSizes.xlarge }]}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.text, fontSize: fontSizes.large }]}>
                {user.name}
              </Text>
              <Text style={[styles.userRole, { color: colors.muted, fontSize: fontSizes.small }]}>
                {user.role === 'admin' ? 'Yönetici' : 'Hasta'}
              </Text>
            </View>
          </View>

          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fontSizes.large }]}>
            Profil Bilgileri
          </Text>

          {/* Info Rows */}
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>
              Ad Soyad
            </Text>
            <Text style={[styles.infoValue, { color: colors.text, fontSize: fontSizes.medium }]}>
              {user.name}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>
              T.C. Kimlik
            </Text>
            <Text style={[styles.infoValue, { color: colors.text, fontSize: fontSizes.medium }]}>
              {maskedTc}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>
              Telefon
            </Text>
            <Text style={[styles.infoValue, { color: colors.text, fontSize: fontSizes.medium }]}>
              {user.phone || 'Belirtilmemiş'}
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.infoLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>
              Kullanıcı Tipi
            </Text>
            <Text style={[styles.infoValue, { color: colors.text, fontSize: fontSizes.medium }]}>
              {user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.primary, borderRadius: radius.button }]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Çıkış yap"
            accessibilityHint="Sistemden çıkış yapmak için çift tıklayın"
          >
            <Text pointerEvents="none" style={[styles.logoutBtnText, { fontSize: fontSizes.large }]}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        {/* Accessibility Settings Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card, marginTop: 16 }]}>
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fontSizes.large }]}>
            Erişilebilirlik Ayarları
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.muted, fontSize: fontSizes.small }]}>
            Uygulamanın görünümünü ve ses rehberini ihtiyacınıza göre ayarlayın.
          </Text>

          {/* Toggle Switches */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fontSizes.medium }]}>
                Büyük Yazı Modu
              </Text>
              <Text style={[styles.toggleSub, { color: colors.muted, fontSize: fontSizes.small }]}>
                Tüm metinleri ve butonları büyütür
              </Text>
            </View>
            <Switch
              value={accessibilitySettings.largeText}
              onValueChange={() => handleToggle('largeText')}
              trackColor={{ false: '#dddddd', true: colors.primary }}
              thumbColor={accessibilitySettings.largeText ? '#ffffff' : '#f4f3f4'}
              accessibilityRole="switch"
              accessibilityLabel="Büyük Yazı Modu"
              accessibilityState={{ checked: accessibilitySettings.largeText }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fontSizes.medium }]}>
                Yüksek Kontrast Modu
              </Text>
              <Text style={[styles.toggleSub, { color: colors.muted, fontSize: fontSizes.small }]}>
                Renk kontrastını artırarak okunabilirliği iyileştirir
              </Text>
            </View>
            <Switch
              value={accessibilitySettings.highContrast}
              onValueChange={() => handleToggle('highContrast')}
              trackColor={{ false: '#dddddd', true: colors.primary }}
              thumbColor={accessibilitySettings.highContrast ? '#ffffff' : '#f4f3f4'}
              accessibilityRole="switch"
              accessibilityLabel="Yüksek Kontrast Modu"
              accessibilityState={{ checked: accessibilitySettings.highContrast }}
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fontSizes.medium }]}>
                Sesli Rehber
              </Text>
              <Text style={[styles.toggleSub, { color: colors.muted, fontSize: fontSizes.small }]}>
                Ekranları gezinirken otomatik sesli yönlendirme yapar
              </Text>
            </View>
            <Switch
              value={accessibilitySettings.voiceGuide}
              onValueChange={() => handleToggle('voiceGuide')}
              trackColor={{ false: '#dddddd', true: colors.primary }}
              thumbColor={accessibilitySettings.voiceGuide ? '#ffffff' : '#f4f3f4'}
              accessibilityRole="switch"
              accessibilityLabel="Sesli Rehber"
              accessibilityState={{ checked: accessibilitySettings.voiceGuide }}
            />
          </View>
        </View>

        {/* TalkBack Guide Card */}
        <View style={[styles.footerInfo, { backgroundColor: colors.card }]}>
          <Text style={[styles.footerText, { color: colors.text, fontSize: fontSizes.medium }]}>
            💡 Telefonunuzda TalkBack veya VoiceOver açıksa uygulama ekran okuyucularla uyumlu çalışacaktır.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backBtnText: {
    fontWeight: 'bold',
    marginLeft: 4,
  },
  titleSection: {
    marginBottom: 20,
  },
  titleText: {
    fontWeight: 'bold',
  },
  subtitleText: {
    marginTop: 4,
    lineHeight: 20,
  },
  card: {
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontWeight: 'bold',
  },
  userName: {
    fontWeight: 'bold',
  },
  userRole: {
    marginTop: 2,
    fontWeight: '500',
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 14,
  },
  cardSubtitle: {
    marginBottom: 20,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontWeight: '500',
  },
  infoValue: {
    fontWeight: 'bold',
  },
  logoutBtn: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  logoutBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontWeight: 'bold',
  },
  toggleSub: {
    marginTop: 4,
    lineHeight: 16,
  },
  footerInfo: {
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#dddddd',
  },
  footerText: {
    lineHeight: 20,
  },
});
