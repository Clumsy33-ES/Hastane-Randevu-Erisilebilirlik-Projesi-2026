import React, { useState, useEffect, useRef } from 'react';
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
  const isLoadingRef = useRef(false);
  const [physicianInfo, setPhysicianInfo] = useState(null); // { has_family_physician, id, doctor_name, clinic_name, city, district }
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookingStep, setBookingStep] = useState(1); // 1: Date, 2: Slot, 3: Confirm
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isBooking, setIsBooking] = useState(false);

  // Assignment states (used when has_family_physician is false)
  const [assignStep, setAssignStep] = useState(1); // 1: City, 2: District, 3: Doctor Selection, 4: Confirm Assign
  const [selectedPhysicianToAssign, setSelectedPhysicianToAssign] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [physicians, setPhysicians] = useState([]);

  useEffect(() => {
    let isMounted = true;
    voiceService.setScreen('familyPhysician');
    
    // Yalnızca ilk montajda "Aile hekimi ekranındasınız" demesi için ufak bir kontrol eklenebilir,
    // ancak şu anki durumda adım değiştikçe re-mount gibi düşünerek sadece ilk açılışı varsayıyoruz.

    const startListener = () => {
      voiceService.startListening(
        (text) => {
          const norm = text.toLowerCase().trim();
          console.log('[FamilyPhysician Voice]', norm);
          
          if (voiceService.handleGlobalCommand(norm, setScreen)) return;

          // Eğer atama onayı adımındaysak
          if (assignStep === 4 && selectedPhysicianToAssign) {
            if (norm.includes('evet') || norm.includes('onayla') || norm.includes('ata')) {
              performAssign();
            } else if (norm.includes('hayır') || norm.includes('iptal') || norm.includes('vazgeç')) {
              setAssignStep(3);
              voiceService.speak('Atama işlemi iptal edildi. Farklı bir hekim seçebilirsiniz.');
            }
          }
          // Eğer randevu onayı adımındaysak
          else if (bookingStep === 3 && selectedSlot) {
            if (norm.includes('evet') || norm.includes('onayla') || norm.includes('al')) {
              performBooking();
            } else if (norm.includes('hayır') || norm.includes('iptal') || norm.includes('vazgeç')) {
              setBookingStep(2);
              voiceService.speak('Randevu alma işlemi iptal edildi. Farklı bir saat seçebilirsiniz.');
            }
          }
        },
        () => {},
        (err) => console.log('[FamilyPhysician Voice Error]', err),
        () => console.log('[FamilyPhysician Voice Started]')
      );
    };

    startListener();

    return () => {
      isMounted = false;
      voiceService.stopListening();
    };
  }, [bookingStep, assignStep, selectedSlot, selectedPhysicianToAssign]);

  // Sadece sayfa ilk açıldığında data yüklemek için:
  useEffect(() => {
    if (accessibilitySettings?.voiceGuide) {
      voiceService.speak('Aile hekimi ekranındasınız.');
    }
    loadData();
  }, []);

  const loadData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
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
      isLoadingRef.current = false;
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

  const handleAssignPhysician = (physician) => {
    setSelectedPhysicianToAssign(physician);
    setAssignStep(4);
    if (accessibilitySettings?.voiceGuide) {
      voiceService.speak(`${physician.doctor_name} isimli hekimi aile hekiminiz olarak atamak istiyor musunuz? Evet veya hayır diyebilirsiniz.`);
    }
  };

  const performAssign = async () => {
    if (isBooking) return;
    setIsBooking(true);
    setLoading(true);
    voiceService.stopListening();
    try {
      await apiClient.post('/family-physician/assign', {
        family_physician_id: selectedPhysicianToAssign.id,
      });
      const successMsg = 'Aile hekimi başarıyla atandı.';
      if (accessibilitySettings?.voiceGuide) {
        await voiceService.speak(successMsg, () => { loadData(); }, true);
      } else {
        Alert.alert('Başarılı', successMsg);
        loadData();
      }
    } catch (e) {
      console.error('[Assign Error]', e);
      const errorMsg = 'Aile hekimi atanırken hata oluştu.';
      Alert.alert('Hata', errorMsg);
      if (accessibilitySettings?.voiceGuide) voiceService.speak(errorMsg);
    } finally {
      setLoading(false);
      setIsBooking(false);
    }
  };

  const handleBookSlot = (slot) => {
    setSelectedSlot(slot);
    setBookingStep(3);
    if (accessibilitySettings?.voiceGuide) {
      const parts = slot.date.split('-');
      const formattedDate = `${parts[2]} ${parts[1]} ${parts[0]}`;
      voiceService.speak(`${formattedDate} günü saat ${slot.time} için randevu almak istiyor musunuz? Evet veya hayır diyebilirsiniz.`);
    }
  };

  const performBooking = async () => {
    if (isBooking) return;
    setIsBooking(true);
    setLoading(true);
    voiceService.stopListening();
    try {
      const userDataStr = await AsyncStorage.getItem('user');
      const userObj = JSON.parse(userDataStr || '{}');

      const response = await apiClient.post('/family-physician/book', {
        user_id: userObj.id || 1,
        family_physician_id: physicianInfo.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        slot_id: selectedSlot.id,
      });
      
      if (response.data && response.data.success === false) {
          throw new Error(response.data.message || 'Randevu alınamadı.');
      }

      const msg = 'Randevunuz başarıyla oluşturuldu.';
      if (accessibilitySettings?.voiceGuide) {
        await voiceService.speak(msg, () => { setScreen('myAppointments'); }, true);
      } else {
        Alert.alert('Başarılı', msg, [
          { text: 'Tamam', onPress: () => setScreen('myAppointments') },
        ]);
      }
    } catch (e) {
      console.error('[Book Slot Error]', e);
      const isSlotFull = e.response?.status === 400 || e.message?.includes('dolu') || e.response?.data?.detail?.includes('dolu');
      const errorMsg = isSlotFull ? 'Bu saat dolu. Lütfen başka bir saat seçin.' : (e.response?.data?.detail || 'Randevu alınamadı.');
      
      Alert.alert('Hata', errorMsg);
      
      if (isSlotFull) {
        setSelectedSlot(null);
        if (accessibilitySettings?.voiceGuide) {
          await voiceService.speak('Bu saat dolu. Lütfen başka bir saat seçin.', () => {
             loadData().then(() => { setBookingStep(2); });
          }, true);
        } else {
          loadData().then(() => { setBookingStep(2); });
        }
      } else {
        if (accessibilitySettings?.voiceGuide) voiceService.speak(errorMsg);
      }
    } finally {
      setLoading(false);
      setIsBooking(false);
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
    if (physicianInfo?.has_family_physician) {
      if (bookingStep === 2) {
        setBookingStep(1);
      } else {
        setScreen('home');
      }
    } else {
      if (assignStep > 1) {
        setAssignStep(assignStep - 1);
      } else {
        setScreen('home');
      }
    }
  };

  const getFilteredSlots = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    return slots.filter(slot => {
      if (!slot.date) return false;
      if (slot.date < todayStr) return false;
      if (slot.date === todayStr) {
        if (!slot.time) return false;
        const [slotHour, slotMin] = slot.time.split(':').map(Number);
        if (slotHour < currentHour || (slotHour === currentHour && slotMin <= currentMin)) {
          return false;
        }
      }
      return true;
    });
  };

  const getUniqueDates = () => {
    const filtered = getFilteredSlots();
    const dates = [...new Set(filtered.map(s => s.date))];
    dates.sort();
    return dates;
  };

  const getFilteredSlotsForSelectedDate = () => {
    const filtered = getFilteredSlots();
    return filtered.filter(s => s.date === selectedDate);
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

            {/* List of slots/dates */}
            {bookingStep === 1 && (
              <>
                <Text style={[styles.slotsHeading, { color: colors.text, fontSize: fontSizes.large }]}>
                  Müsait Randevu Tarihleri
                </Text>
                {getUniqueDates().length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="event-busy" size={48} color={colors.muted} />
                    <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                      Müsait randevu tarihi bulunmamaktadır.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={getUniqueDates()}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => {
                      const formattedDate = formatDateTurkish(item);
                      return (
                        <TouchableOpacity
                          style={[styles.slotRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => {
                            setSelectedDate(item);
                            setBookingStep(2);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={formattedDate}
                        >
                          <Text style={[styles.slotTimeText, { color: colors.text, fontSize: fontSizes.large }]}>
                            {formattedDate}
                          </Text>
                          <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </>
            )}
            
            {bookingStep === 2 && (
              <>
                <Text style={[styles.slotsHeading, { color: colors.text, fontSize: fontSizes.large }]}>
                  Müsait Randevu Saatleri ({formatDateTurkish(selectedDate)})
                </Text>
                {getFilteredSlotsForSelectedDate().length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="event-busy" size={48} color={colors.muted} />
                    <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                      Bu tarihte müsait saat bulunmamaktadır.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={getFilteredSlotsForSelectedDate()}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => {
                      return (
                        <TouchableOpacity
                          style={[styles.slotRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => handleBookSlot(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`Saat ${item.time}`}
                          accessibilityHint="Bu saat için aile hekimi randevusu almak üzere onay penceresi açar"
                        >
                          <View style={styles.slotLeft}>
                            <MaterialIcons name="schedule" size={22} color={colors.primary} />
                            <Text style={[styles.slotTimeText, { color: colors.text, fontSize: fontSizes.large }]}>
                              {item.time}
                            </Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </>
            )}

            {bookingStep === 3 && selectedSlot && (
              <View style={[styles.physicianCard, { backgroundColor: colors.card, borderRadius: radius.card, marginTop: 16 }]}>
                <Text style={{ color: colors.text, fontSize: fontSizes.xlarge, fontWeight: 'bold', marginBottom: 16 }}>
                  Randevu Onayı
                </Text>
                <Text style={{ color: colors.text, fontSize: fontSizes.medium, marginBottom: 8 }}>
                  Tarih: {selectedSlot.date.split('-').reverse().join('.')}
                </Text>
                <Text style={{ color: colors.text, fontSize: fontSizes.medium, marginBottom: 8 }}>
                  Saat: {selectedSlot.time}
                </Text>
                <Text style={{ color: colors.text, fontSize: fontSizes.medium, marginBottom: 8 }}>
                  Hekim: {physicianInfo.doctor_name}
                </Text>
                <Text style={{ color: colors.text, fontSize: fontSizes.medium, marginBottom: 24 }}>
                  Klinik: {physicianInfo.clinic_name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <AccessibleButton title="Vazgeç" onPress={() => setBookingStep(2)} style={{ flex: 1, backgroundColor: colors.muted, borderColor: 'transparent' }} textStyle={{ color: '#fff' }} />
                  <AccessibleButton title={isBooking ? "Alınıyor..." : "Onayla"} onPress={performBooking} disabled={isBooking} style={{ flex: 1 }} />
                </View>
              </View>
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

            {assignStep === 4 && selectedPhysicianToAssign && (
              <View style={[styles.physicianCard, { backgroundColor: colors.card, borderRadius: radius.card, marginTop: 16 }]}>
                <Text style={{ color: colors.text, fontSize: fontSizes.xlarge, fontWeight: 'bold', marginBottom: 16 }}>
                  Hekim Atama Onayı
                </Text>
                <Text style={{ color: colors.text, fontSize: fontSizes.medium, marginBottom: 8 }}>
                  Hekim: {selectedPhysicianToAssign.doctor_name}
                </Text>
                <Text style={{ color: colors.text, fontSize: fontSizes.medium, marginBottom: 24 }}>
                  Klinik: {selectedPhysicianToAssign.clinic_name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <AccessibleButton title="Vazgeç" onPress={() => setAssignStep(3)} style={{ flex: 1, backgroundColor: colors.muted, borderColor: 'transparent' }} textStyle={{ color: '#fff' }} />
                  <AccessibleButton title={isBooking ? "Atanıyor..." : "Evet, Ata"} onPress={performAssign} disabled={isBooking} style={{ flex: 1 }} />
                </View>
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
