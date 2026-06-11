import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import apiClient from '../api/api';
import { getTheme, radius, colors as defaultColors } from '../styles/theme';
import { voiceService } from '../utils/speech';
import { isPresentationMode, MIN_TOUCH_TARGET } from '../utils/buildConfig';

export default function MyAppointmentsScreen({ setScreen, accessibilitySettings, registerVoiceCallback }) {
  const [tab, setTab] = useState('active'); // 'active' | 'past'
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Voice states
  const [voiceStep, setVoiceStep] = useState('idle'); // 'idle' | 'cancel_ask' | 'cancel_confirm'
  const [selectedCancelItem, setSelectedCancelItem] = useState(null);

  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  const fetchAppointments = async (selectedTab) => {
    setLoading(true);
    try {
      const endpoint = selectedTab === 'active' ? '/appointments/active' : '/appointments/past';
      const response = await apiClient.get(endpoint);
      setAppointments(response.data || []);
    } catch (error) {
      console.error(`[Fetch Appointments Error - ${selectedTab}]`, error);
      Alert.alert('Hata', 'Randevular yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments(tab);
  }, [tab]);

  useEffect(() => {
    voiceService.setScreen('myAppointments');
    if (accessibilitySettings?.voiceGuide || isPresentationMode()) {
      const msg = isPresentationMode()
        ? 'Randevularım ekranındasınız. Aktif ve geçmiş randevularınızı sekmelerden görüntüleyebilirsiniz.'
        : 'Randevularım ekranındasınız. Randevularınızı okutmak için "randevularımı oku" diyebilirsiniz.';
      voiceService.speak(msg, null, isPresentationMode());
    }
    
    return () => {
      if (registerVoiceCallback) registerVoiceCallback(null);
    };
  }, []);

  const normalizeText = (text) => {
    if (!text) return '';
    return text.toLowerCase().trim()
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s]/g, '');
  };

  useEffect(() => {
    if (registerVoiceCallback && !isPresentationMode() && !loading) {
      registerVoiceCallback((text) => handleVoiceInput(text));
    } else if (registerVoiceCallback) {
      registerVoiceCallback(null);
    }
  }, [loading, tab, appointments, voiceStep, selectedCancelItem]);

  const handleVoiceInput = async (transcript) => {
    if (!transcript || transcript.trim() === '') {
      return;
    }

    if (voiceService.handleGlobalCommand(transcript, setScreen)) {
      return;
    }

    const norm = normalizeText(transcript);

    if (voiceStep === 'idle') {
      if (norm.includes('aktif randevular')) {
        setTab('active');
        voiceService.speak('Aktif randevular listeleniyor.', null, true);
        return;
      }
      if (norm.includes('gecmis randevular')) {
        setTab('past');
        voiceService.speak('Geçmiş randevular listeleniyor.', null, true);
        return;
      }
      if (norm.includes('randevularimi oku') || norm.includes('randevulari oku') || norm.includes('oku')) {
        if (appointments.length === 0) {
          voiceService.speak('Listede randevunuz bulunmuyor.', null, true);
          return;
        }
        let msg = '';
        appointments.forEach((a, idx) => {
          msg += `${idx + 1}. seçenek: ${a.hospital_name || 'Bilinmeyen Kurum'}, ${a.branch_name || 'Aile Hekimliği'}, ${formatDateTurkish(a.date)} saat ${a.time}. `;
        });
        voiceService.speak(msg, null, true);
        return;
      }
      if (norm.includes('iptal et')) {
        if (tab !== 'active' || appointments.length === 0) {
          voiceService.speak('İptal edilebilecek aktif randevunuz bulunmuyor.', null, true);
          return;
        }
        setVoiceStep('cancel_ask');
        voiceService.speak('Kaldırmak istediğiniz randevunun numarasını söyleyin. Örneğin birinci, ikinci.', null, true);
        return;
      }
    } else if (voiceStep === 'cancel_ask') {
      if (norm.includes('iptal') || norm.includes('geri')) {
        setVoiceStep('idle');
        voiceService.speak('İptal işlemi durduruldu.', null, true);
        return;
      }
      const indexWords = {
        'bir': 0, 'birinci': 0, '1': 0, 'ilk': 0,
        'iki': 1, 'ikinci': 1, '2': 1,
        'uc': 2, 'ucuncu': 2, '3': 2,
        'dort': 3, 'dorduncu': 3, '4': 3,
        'bes': 4, 'besinci': 4, '5': 4,
      };
      
      let matchedIndex = -1;
      const tokens = norm.split(/\s+/);
      for (const word in indexWords) {
        if (tokens.includes(word) || norm === word) {
          matchedIndex = indexWords[word];
          break;
        }
      }

      if (matchedIndex !== -1 && matchedIndex < appointments.length) {
        const selected = appointments[matchedIndex];
        setSelectedCancelItem(selected);
        setVoiceStep('cancel_confirm');
        voiceService.speak(`${matchedIndex + 1} numaralı randevuyu iptal etmek istiyor musunuz? Evet veya hayır deyin.`, null, true);
      } else {
        voiceService.speak('Geçersiz numara. Lütfen iptal etmek istediğiniz randevunun numarasını söyleyin.', null, true);
      }
    } else if (voiceStep === 'cancel_confirm') {
      const confirmCommands = ['evet', 'onayliyorum', 'onayla', 'kabul'];
      const isConfirm = confirmCommands.some(cmd => norm === cmd || norm.includes(cmd));
      const rejectCommands = ['hayir', 'vazgec', 'iptal'];
      const isReject = rejectCommands.some(cmd => norm === cmd || norm.includes(cmd));

      if (isConfirm && selectedCancelItem) {
        setVoiceStep('idle');
        handleCancelAppointment(selectedCancelItem, "Sesli komutla iptal ediliyor", true);
      } else if (isReject) {
        setVoiceStep('idle');
        setSelectedCancelItem(null);
        voiceService.speak('İptal işlemi durduruldu.', null, true);
      } else {
        voiceService.speak('Lütfen evet veya hayır deyin.', null, true);
      }
    }
  };

  const handleCancelAppointment = (item, detailText, fromVoice = false) => {
    const performCancel = async () => {
      try {
        const isFp = item.appointment_type === 'family_physician';
        const endpoint = isFp
          ? `/family-physician/appointments/${item.id}`
          : `/appointments/${item.id}`;

        await apiClient.delete(endpoint);
        
        const successMsg = 'Randevu iptal edildi.';
        Alert.alert('Başarılı', successMsg);
        voiceService.speak(successMsg, null, true);
        fetchAppointments(tab);
      } catch (error) {
        console.error('[Cancel Appointment Error]', error);
        const errorMsg = error.response?.data?.detail || 'Randevu iptal edilemedi.';
        Alert.alert('Hata', errorMsg);
        voiceService.speak('Randevu iptal edilemedi.', null, true);
      }
    };

    if (fromVoice) {
      performCancel();
      return;
    }

    const confirmMessage = 'Randevuyu iptal etmek istiyor musunuz?';
    Alert.alert('Randevu İptali', confirmMessage, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Evet, İptal Et', style: 'destructive', onPress: performCancel },
    ]);
  };

  const handleSpeechGuide = () => {
    voiceService.speak(
      'Randevularım ekranındasınız. Aktif ve geçmiş randevularınızı görüntüleyebilir, aktif randevularınızı iptal edebilirsiniz.',
      null,
      true // force speak since manually triggered
    );
  };

  const formatDateTurkish = (dateString) => {
    if (!dateString) return '';
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const months = [
          'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
        ];
        const day = parseInt(parts[2], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const year = parts[0];
        if (monthIndex >= 0 && monthIndex < 12) {
          return `${day} ${months[monthIndex]} ${year}`;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return dateString;
  };

  const renderAppointmentItem = ({ item }) => {
    const formattedDate = formatDateTurkish(item.date);
    const isFp = item.appointment_type === 'family_physician';
    const accessibilityText = `${isFp ? 'Aile hekimliği' : (item.branch_name || 'Sağlık')} randevusu. Doktor ${item.doctor_name || 'Bilinmiyor'}. Hastane veya Klinik ${item.hospital_name || 'Bilinmiyor'}. Tarih ${formattedDate || 'Belirtilmemiş'}. Saat ${item.time || 'Belirtilmemiş'}.`;

    return (
      <View
        style={[styles.appointmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessible={true}
        accessibilityLabel={accessibilityText}
      >
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.branchWrapper}>
            <MaterialIcons
              name={isFp ? 'person' : 'local-hospital'}
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.branchName, { color: colors.text, fontSize: fontSizes.medium }]}>
              {isFp ? 'Aile Hekimliği' : (item.branch_name || 'Hastane Randevusu')}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: item.status === 'cancelled' ? '#ffebeb' : '#e6f9ed' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: item.status === 'cancelled' ? colors.primary : '#28a745',
                  fontSize: fontSizes.small,
                },
              ]}
            >
              {item.status === 'active' ? 'Aktif' : 'İptal Edildi'}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.infoText, { color: colors.text, fontSize: fontSizes.medium }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Doktor: </Text>
            {item.doctor_name}
          </Text>
          <Text style={[styles.infoText, { color: colors.text, fontSize: fontSizes.medium }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Hastane / Klinik: </Text>
            {item.hospital_name}
          </Text>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeField}>
              <MaterialIcons name="event" size={18} color={colors.muted} style={{ marginRight: 6 }} />
              <Text style={[styles.dateTimeText, { color: colors.text, fontSize: fontSizes.small }]}>
                {formattedDate}
              </Text>
            </View>
            <View style={styles.dateTimeField}>
              <MaterialIcons name="schedule" size={18} color={colors.muted} style={{ marginRight: 6 }} />
              <Text style={[styles.dateTimeText, { color: colors.text, fontSize: fontSizes.small }]}>
                {item.time}
              </Text>
            </View>
          </View>
        </View>

        {tab === 'active' && item.status === 'active' && (
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.primary, borderRadius: radius.button - 3 }]}
            onPress={() => handleCancelAppointment(item, accessibilityText)}
            accessibilityRole="button"
            accessibilityLabel="Randevuyu iptal et"
            accessibilityHint="Seçili randevuyu iptal etmek için onay penceresi açar"
            activeOpacity={0.7}
          >
            <MaterialIcons name="cancel" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={[styles.cancelBtnText, { fontSize: fontSizes.medium }]}>
              Randevuyu İptal Et
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
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

          <TouchableOpacity
            style={[styles.speechBtn, { backgroundColor: colors.primary }]}
            onPress={handleSpeechGuide}
            accessibilityRole="button"
            accessibilityLabel="Sesli rehberi dinle"
            accessibilityHint="Ekran açıklamalarını sesli okur"
          >
            <MaterialIcons name="volume-up" size={24} color="#ffffff" />
            <Text style={[styles.speechBtnText, { fontSize: fontSizes.small }]}>Sesli Rehber</Text>
          </TouchableOpacity>
        </View>

        {/* Title details */}
        <View style={styles.titleSection}>
          <Text style={[styles.titleText, { color: colors.text, fontSize: fontSizes.xxlarge }]}>
            Randevularım
          </Text>
          <Text style={[styles.subtitleText, { color: colors.muted, fontSize: fontSizes.medium }]}>
            Aktif ve geçmiş randevularınızı buradan takip edebilirsiniz.
          </Text>
        </View>

        {/* Tab configuration */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'active' && styles.activeTabButton]}
            onPress={() => setTab('active')}
            accessibilityRole="tab"
            accessibilityLabel="Aktif randevular sekmesi"
            accessibilityState={{ selected: tab === 'active' }}
          >
            <Text
              style={[
                styles.tabButtonText,
                { fontSize: fontSizes.medium },
                tab === 'active' && styles.activeTabButtonText,
              ]}
            >
              Aktif Randevular
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'past' && styles.activeTabButton]}
            onPress={() => setTab('past')}
            accessibilityRole="tab"
            accessibilityLabel="Geçmiş randevular sekmesi"
            accessibilityState={{ selected: tab === 'past' }}
          >
            <Text
              style={[
                styles.tabButtonText,
                { fontSize: fontSizes.medium },
                tab === 'past' && styles.activeTabButtonText,
              ]}
            >
              Geçmiş Randevular
            </Text>
          </TouchableOpacity>
        </View>

        {/* List of appointments */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={appointments}
            renderItem={renderAppointmentItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="event-busy" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                  {tab === 'active'
                    ? 'Aktif randevunuz bulunmamaktadır.'
                    : 'Geçmiş randevunuz bulunmamaktadır.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  speechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  speechBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 6,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e6dfdf',
    borderRadius: radius.input,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.input - 2,
  },
  activeTabButton: {
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  tabButtonText: {
    fontWeight: '600',
    color: defaultColors.muted,
  },
  activeTabButtonText: {
    color: defaultColors.text,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 24,
  },
  appointmentCard: {
    borderRadius: radius.card,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 10,
  },
  branchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchName: {
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontWeight: 'bold',
  },
  cardBody: {
    marginBottom: 12,
  },
  infoText: {
    marginBottom: 6,
  },
  infoLabel: {
    fontWeight: '500',
  },
  dateTimeRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 16,
  },
  dateTimeField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateTimeText: {
    fontWeight: '500',
  },
  cancelBtn: {
    flexDirection: 'row',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
  },
});
