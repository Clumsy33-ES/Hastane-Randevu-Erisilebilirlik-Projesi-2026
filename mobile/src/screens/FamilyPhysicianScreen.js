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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import apiClient from '../api/api';
import { getTheme, radius } from '../styles/theme';
import { voiceService } from '../utils/speech';
import AccessibleButton from '../components/AccessibleButton';

export default function FamilyPhysicianScreen({ setScreen, accessibilitySettings }) {
  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  const [loading, setLoading] = useState(false);
  const [physicianInfo, setPhysicianInfo] = useState(null); // { has_family_physician, id, doctor_name, clinic_name, city, district }
  const [slots, setSlots] = useState([]);

  // Assignment states (used when has_family_physician is false)
  const [assignStep, setAssignStep] = useState(1); // 1: City, 2: District, 3: Doctor Selection
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [physicians, setPhysicians] = useState([]);

  useEffect(() => {
    voiceService.setScreen('familyPhysician');
    if (accessibilitySettings?.voiceGuide) {
      voiceService.speak('Aile hekimi ekranındasınız.');
    }
    loadData();

    return () => {
      voiceService.cleanup();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/family-physician/me');
      setPhysicianInfo(response.data);

      if (response.data.has_family_physician) {
        // Fetch slots
        const slotResponse = await apiClient.get('/family-physician/slots');
        setSlots(slotResponse.data || []);
      } else {
        // Load initial cities for assignment
        const cityResponse = await apiClient.get('/locations/cities');
        setCities(cityResponse.data || []);
      }
    } catch (e) {
      console.error('[Load Family Physician Error]', e);
      Alert.alert('Hata', 'Aile hekimi bilgileri yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDistricts = async (cityId) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/locations/districts?city_id=${cityId}`);
      setDistricts(response.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhysicians = async (cityName, distName) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/family-physicians?city=${cityName}&district=${distName}`);
      setPhysicians(response.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    fetchDistricts(city.id);
    setAssignStep(2);
  };

  const handleDistrictSelect = (district) => {
    setSelectedDistrict(district);
    fetchPhysicians(selectedCity.name, district.name);
    setAssignStep(3);
  };

  const handleAssignPhysician = async (physician) => {
    const performAssign = async () => {
      setLoading(true);
      try {
        await apiClient.post('/family-physician/assign', {
          family_physician_id: physician.id,
        });
        Alert.alert('Başarılı', 'Aile hekimi başarıyla atandı.');
        loadData();
      } catch (e) {
        console.error('[Assign Error]', e);
        Alert.alert('Hata', 'Aile hekimi atanırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    const confirmMsg = `${physician.doctor_name} isimli hekimi aile hekiminiz olarak atamak istiyor musunuz?`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) performAssign();
    } else {
      Alert.alert('Hekim Ata', confirmMsg, [
        { text: 'İptal', style: 'cancel' },
        { text: 'Evet, Ata', onPress: performAssign },
      ]);
    }
  };

  const handleBookSlot = async (slot) => {
    const performBooking = async () => {
      setLoading(true);
      try {
        const userDataStr = await AsyncStorage.getItem('user');
        const userObj = JSON.parse(userDataStr || '{}');

        await apiClient.post('/family-physician/book', {
          user_id: userObj.id || 1,
          family_physician_id: physicianInfo.id,
          date: slot.date,
          time: slot.time,
          slot_id: slot.id,
        });

        const msg = 'Aile hekimi randevunuz başarıyla oluşturuldu.';
        Alert.alert('Başarılı', msg, [
          { text: 'Tamam', onPress: () => setScreen('myAppointments') },
        ]);
        if (accessibilitySettings?.voiceGuide) {
          voiceService.speak(msg);
        }
      } catch (e) {
        console.error('[Book Slot Error]', e);
        const errorMsg = e.response?.data?.detail || 'Randevu alınamadı.';
        Alert.alert('Hata', errorMsg);
      } finally {
        setLoading(false);
      }
    };

    const confirmMsg = `${slot.date.split('-')[2]}.${slot.date.split('-')[1]}.${slot.date.split('-')[0]} günü saat ${slot.time} için randevu almak istiyor musunuz?`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) performBooking();
    } else {
      Alert.alert('Randevu Onayı', confirmMsg, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Evet, Al', onPress: performBooking },
      ]);
    }
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

  const goBack = () => {
    if (!physicianInfo?.has_family_physician && assignStep > 1) {
      setAssignStep(assignStep - 1);
    } else {
      setScreen('home');
    }
  };

  if (loading && !physicianInfo) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Navigation top bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBack}
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

        {physicianInfo?.has_family_physician ? (
          // ── Case A: Family Physician Assigned ──
          <View style={{ flex: 1 }}>
            {/* Physician Card info */}
            <View style={[styles.physicianCard, { backgroundColor: colors.card, borderRadius: radius.card }]}>
              <View style={styles.physicianTitleRow}>
                <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                  <MaterialIcons name="person" size={32} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docName, { color: colors.text, fontSize: fontSizes.large }]}>
                    {physicianInfo.doctor_name}
                  </Text>
                  <Text style={[styles.clinicName, { color: colors.muted, fontSize: fontSizes.medium }]}>
                    {physicianInfo.clinic_name}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.physicianMetaRow}>
                <MaterialIcons name="location-on" size={20} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.text, fontSize: fontSizes.medium }]}>
                  {physicianInfo.city} / {physicianInfo.district}
                </Text>
              </View>
            </View>

            {/* List of slots */}
            <Text style={[styles.slotsHeading, { color: colors.text, fontSize: fontSizes.large }]}>
              Müsait Randevu Saatleri
            </Text>

            {slots.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="event-busy" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                  Müsait randevu saati bulunmamaktadır.
                </Text>
              </View>
            ) : (
              <FlatList
                data={slots}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                  const formattedDate = formatDateTurkish(item.date);
                  return (
                    <TouchableOpacity
                      style={[styles.slotRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => handleBookSlot(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${formattedDate} saat ${item.time} randevusu`}
                      accessibilityHint="Bu saat için aile hekimi randevusu almak üzere onay penceresi açar"
                    >
                      <View style={styles.slotLeft}>
                        <MaterialIcons name="schedule" size={22} color={colors.primary} />
                        <Text style={[styles.slotTimeText, { color: colors.text, fontSize: fontSizes.large }]}>
                          {item.time}
                        </Text>
                      </View>
                      <Text style={[styles.slotDateText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                        {formattedDate}
                      </Text>
                      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        ) : (
          // ── Case B: Assign Family Physician ──
          <View style={{ flex: 1 }}>
            <View style={[styles.alertBox, { backgroundColor: '#ffebeb', borderColor: colors.primary }]}>
              <MaterialIcons name="info-outline" size={24} color={colors.primary} />
              <Text style={[styles.alertText, { color: colors.text, fontSize: fontSizes.medium }]}>
                Sistemde kayıtlı aile hekiminiz bulunamadı. Lütfen bir aile hekimi seçip atama yapın.
              </Text>
            </View>

            {assignStep === 1 && (
              <View>
                <Text style={[styles.slotsHeading, { color: colors.text, fontSize: fontSizes.large }]}>
                  Şehir Seçin
                </Text>
                <FlatList
                  data={cities}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.slotRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => handleCitySelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                    >
                      <Text style={[styles.slotTimeText, { color: colors.text, fontSize: fontSizes.medium }]}>
                        {item.name}
                      </Text>
                      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {assignStep === 2 && (
              <View>
                <Text style={[styles.slotsHeading, { color: colors.text, fontSize: fontSizes.large }]}>
                  İlçe Seçin
                </Text>
                <FlatList
                  data={districts}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.slotRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => handleDistrictSelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                    >
                      <Text style={[styles.slotTimeText, { color: colors.text, fontSize: fontSizes.medium }]}>
                        {item.name}
                      </Text>
                      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {assignStep === 3 && (
              <View>
                <Text style={[styles.slotsHeading, { color: colors.text, fontSize: fontSizes.large }]}>
                  Aile Hekimi Seçin
                </Text>
                {physicians.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={{ color: colors.muted, fontSize: fontSizes.medium }}>
                      Bu il ve ilçede kayıtlı aile hekimi bulunmamaktadır.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={physicians}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.slotRow, { backgroundColor: colors.card, borderColor: colors.border, padding: 18 }]}
                        onPress={() => handleAssignPhysician(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.doctor_name}. Klinik: ${item.clinic_name}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.slotTimeText, { color: colors.text, fontSize: fontSizes.medium, fontWeight: 'bold' }]}>
                            {item.doctor_name}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: fontSizes.small, marginTop: 4 }}>
                            {item.clinic_name}
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            )}
          </View>
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
  physicianCard: {
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 24,
  },
  physicianTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docName: {
    fontWeight: 'bold',
  },
  clinicName: {
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  physicianMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontWeight: '500',
  },
  slotsHeading: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  slotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotTimeText: {
    fontWeight: 'bold',
  },
  slotDateText: {
    fontWeight: '500',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  alertText: {
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
