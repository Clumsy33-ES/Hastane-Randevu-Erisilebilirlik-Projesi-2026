import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { getTheme, radius } from '../styles/theme';
import { voiceService } from '../utils/speech';
import { detectRecognitionMode } from '../utils/voiceRecognition';

export default function HomeScreen({ setScreen, accessibilitySettings }) {
  const [userRole, setUserRole] = useState('user');
  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  // ─── Auto voice greeting on mount ───────────────────────────────────────
  useEffect(() => {
    voiceService.setScreen('home');

    const fetchRole = async () => {
      try {
        const role = await AsyncStorage.getItem('role');
        if (role) {
          setUserRole(role);
        }
      } catch (e) {
        console.error('[Home] Error reading role:', e);
      }
    };
    fetchRole();

    const greetTimer = setTimeout(() => {
      voiceService.speak(
        'Erişimli Randevu uygulamasına hoş geldiniz. '
        + 'Randevu almak için "Randevu Al" diyebilir, '
        + 'Mevcut randevularınızı dinlemek için "Randevularım" diyebilir, '
        + 'Aile hekimi işlemleri için "Aile Hekimi" diyebilir, '
        + 'Profil bilgileri için "Profil" diyebilir '
        + 'veya ekranı kaydırarak seçenekleri inceleyebilirsiniz.'
      );
    }, 600);

    return () => {
      clearTimeout(greetTimer);
      voiceService.cleanup();
    };
  }, []);

  const handleSpeechGuide = () => {
    voiceService.speak(
      'Ana sayfadasınız. Mevcut seçenekler şunlardır: '
      + 'Birinci seçenek: Sesli Asistan — randevu işlemlerini sesli komutlarla yapın. '
      + 'İkinci seçenek: Hastane Randevusu — branş, doktor ve saat seçin. '
      + 'Üçüncü seçenek: Aile Hekimi — aile hekiminizin randevularını görün. '
      + 'Dördüncü seçenek: Randevularım — aktif ve geçmiş randevularınızı takip edin. '
      + 'Beşinci seçenek: Profil ve Ayarlar — erişilebilirlik seçeneklerini düzenleyin. '
      + 'Çıkış yapmak için son seçeneği kullanabilirsiniz.',
      null,
      true // force speak since manually triggered
    );
  };

  const handleLogout = async () => {
    console.log('[HomeScreen] handleLogout initiated');
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

  const menuItems = [
    {
      title: 'Sesli Asistan',
      subtitle: 'Randevu işlemlerini sesli komutlarla yapın.',
      icon: 'mic',
      accessibilityLabel: 'Sesli asistan',
      accessibilityHint: 'Sesli komutlar ile adım adım randevu alma ekranına gider',
      onPress: () => setScreen('voiceCommandAssistant'),
    },
    {
      title: 'Hastane Randevusu',
      subtitle: 'Branş, doktor ve saat seçerek randevu oluşturun.',
      icon: 'local-hospital',
      accessibilityLabel: 'Hastane randevusu',
      accessibilityHint: 'Branş, doktor ve saat seçerek randevu oluşturma ekranına gider',
      onPress: () => setScreen('appointment'),
    },
    {
      title: 'Aile Hekimi',
      subtitle: 'Aile hekiminiz için uygun randevu saatlerini görüntüleyin.',
      icon: 'person',
      accessibilityLabel: 'Aile hekimi',
      accessibilityHint: 'Aile hekiminiz için uygun randevu saatlerini görüntüleme ekranına gider',
      onPress: () => setScreen('familyPhysician'),
    },
    {
      title: 'Randevularım',
      subtitle: 'Aktif ve geçmiş randevularınızı takip edin.',
      icon: 'event-note',
      accessibilityLabel: 'Randevularım',
      accessibilityHint: 'Aktif ve geçmiş randevularınızı takip etme ekranına gider',
      onPress: () => setScreen('myAppointments'),
    },
    {
      title: 'Profil ve Ayarlar',
      subtitle: 'Kişisel bilgilerinizi ve erişilebilirlik seçeneklerini düzenleyin.',
      icon: 'settings',
      accessibilityLabel: 'Profil ve ayarlar',
      accessibilityHint: 'Hesap bilgilerinizi ve sesli rehber, büyük yazı gibi ayarları düzenleme ekranına gider',
      onPress: () => setScreen('profile'),
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header Section */}
        <View style={styles.header} accessibilityRole="header">
          <View style={styles.headerTitleRow}>
            <View style={styles.logoAndText}>
              <Text style={[styles.headerLogo, { color: colors.primary }]}>Erişimli Randevu</Text>
              <Text style={[styles.welcomeText, { color: colors.text, fontSize: fontSizes.xxlarge }]}>
                Hoş geldiniz
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.speechBtn, { backgroundColor: colors.primary }]}
              onPress={handleSpeechGuide}
              accessibilityRole="button"
              accessibilityLabel="Sesli rehberi dinle"
              accessibilityHint="Ana sayfa açıklamalarını sesli okur"
            >
              <MaterialIcons name="volume-up" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Info and Badge */}
        <View style={styles.roleSection}>
          <Text style={[styles.accountLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>
            {userRole === 'admin' ? 'Yönetici Hesabı' : 'Kullanıcı Hesabı'}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>
              {userRole === 'admin' ? 'Yönetici' : 'Kullanıcı'}
            </Text>
          </View>
        </View>

        {/* Menu Cards */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
              accessibilityHint={item.accessibilityHint}
              activeOpacity={0.75}
            >
              {/* Circular Left Icon Container */}
              <View style={styles.iconContainer}>
                <MaterialIcons name={item.icon} size={28} color={colors.primary} />
              </View>
              {/* Middle Text Details */}
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: fontSizes.large }]}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted, fontSize: fontSizes.medium }]}>
                  {item.subtitle}
                </Text>
              </View>
              {/* Right Chevron Arrow */}
              <MaterialIcons name="chevron-right" size={26} color={colors.muted} />
            </TouchableOpacity>
          ))}

          {/* Logout Card */}
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Çıkış yap"
            accessibilityHint="Oturumunuzu kapatır ve giriş ekranına döner"
            activeOpacity={0.75}
          >
            <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', width: '100%', flex: 1 }}>
              <View style={[styles.iconContainer, styles.logoutIconContainer, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="logout" size={26} color="#ffffff" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, styles.logoutText, { color: colors.primary, fontSize: fontSizes.large }]}>
                  Çıkış Yap
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted, fontSize: fontSizes.medium }]}>
                  Oturumunuzu güvenli şekilde sonlandırın.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={26} color={colors.muted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Accessibility Tip Box */}
        <View style={[styles.footerInfo, { backgroundColor: colors.card }]}>
          <Text style={[styles.footerText, { color: colors.text, fontSize: fontSizes.medium }]}>
            İpucu: Menü kartları geniş dokunma alanlarına sahiptir. TalkBack veya VoiceOver ile kolayca gezebilirsiniz.
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
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoAndText: {
    flex: 1,
  },
  headerLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  welcomeText: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  speechBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
  },
  roleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    flexWrap: 'wrap',
    gap: 8,
  },
  accountLabel: {
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  menuContainer: {
    gap: 16,
  },
  card: {
    borderRadius: radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
    minHeight: 88, // Easy tap size
    borderWidth: 1,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffebeb', // Light red themed circular container
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  logoutIconContainer: {
    // Red background for the exit icon
  },
  cardContent: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontWeight: 'bold',
  },
  logoutText: {
    //
  },
  cardSubtitle: {
    marginTop: 4,
    lineHeight: 18,
  },
  footerInfo: {
    marginTop: 28,
    borderRadius: radius.input,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#dddddd',
  },
  footerText: {
    lineHeight: 20,
  },
});
