import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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

export default function AppointmentScreen({ setScreen, accessibilitySettings }) {
  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  const [step, setStep] = useState(1); // 1: City, 2: District, 3: Branch, 4: Hospital, 5: Doctor, 6: Slot, 7: Confirm
  const [loading, setLoading] = useState(false);

  // Selections
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null); // { id, name } or null (Fark etmez)
  const [selectedSlot, setSelectedSlot] = useState(null);

  // List Data
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [pageOffset, setPageOffset] = useState(0);
  const isProcessing = React.useRef(false);
  const lastTranscript = React.useRef('');

  const handleApiError = (e, defaultMsg) => {
    console.error('[API Error]', e);
    if (e.response?.status === 401) {
      Alert.alert('Oturum Hatası', 'Oturum süreniz doldu, tekrar giriş yapın.', [
        { text: 'Tamam', onPress: () => setScreen('login') },
      ]);
    } else {
      const errorMsg = e.response?.data?.detail || defaultMsg;
      Alert.alert('Hata', errorMsg);
    }
  };

  // Load cities on mount
  useEffect(() => {
    voiceService.setScreen('appointment');
    fetchCities();

    return () => {
      voiceService.cleanup();
    };
  }, []);

  const wakeUpBackend = async () => {
    console.log("API URL:", apiClient.defaults.baseURL);
    console.log("Checking backend health (waking up if sleeping)...");
    try {
      await apiClient.get('/health', { timeout: 60000 });
      console.log("Backend is awake and healthy.");
      return true;
    } catch (e) {
      console.warn("Backend health check failed or timed out:", e.message);
      return false;
    }
  };

  const fetchCities = async () => {
    setLoading(true);
    console.log("API URL:", apiClient.defaults.baseURL);
    console.log("Fetching cities...");
    try {
      await wakeUpBackend();
      const response = await apiClient.get('/locations/cities');
      setCities(response.data || []);
    } catch (e) {
      console.error('[Fetch Cities Error]', e);
      if (e.response?.status === 401) {
        Alert.alert('Oturum Hatası', 'Oturum süreniz doldu, tekrar giriş yapın.', [
          { text: 'Tamam', onPress: () => setScreen('login') },
        ]);
      } else {
        Alert.alert(
          'Bağlantı Hatası',
          'Veriler yüklenemedi. Lütfen internet bağlantınızı kontrol edin.'
        );
      }
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
      handleApiError(e, 'İlçeler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/branches');
      setBranches(response.data || []);
    } catch (e) {
      handleApiError(e, 'Branşlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitals = async (cityId, districtId, branchId) => {
    setLoading(true);
    try {
      let url = `/hospitals?city_id=${cityId}&district_id=${districtId}&branch_id=${branchId}`;
      const response = await apiClient.get(url);
      console.log("Selected filters:", selectedCity, selectedDistrict, selectedBranch);
      console.log("Hospital request params:", {
        city_id: cityId,
        district_id: districtId,
        branch_id: branchId
      });
      console.log("Hospitals response:", response.data);
      
      let hospitalList = [];
      if (Array.isArray(response.data)) {
        hospitalList = response.data;
      } else if (response.data && Array.isArray(response.data.hospitals)) {
        hospitalList = response.data.hospitals;
      } else if (response.data && Array.isArray(response.data.value)) {
        hospitalList = response.data.value;
      }
      return hospitalList;
    } catch (e) {
      handleApiError(e, 'Hastaneler yüklenirken hata oluştu.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async (hospitalId, branchId) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/doctors?hospital_id=${hospitalId}&branch_id=${branchId}`);
      setDoctors(response.data || []);
    } catch (e) {
      handleApiError(e, 'Doktorlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async (docId, hospId, branId) => {
    setLoading(true);
    try {
      let url = `/appointments/slots?hospital_id=${hospId}&branch_id=${branId}`;
      if (docId) {
        url += `&doctor_id=${docId}`;
      }
      const response = await apiClient.get(url);
      setSlots(response.data || []);
    } catch (e) {
      handleApiError(e, 'Uygun randevu saatleri yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCitySelect = (city) => {
    setPageOffset(0);
    setSelectedCity(city);
    // Cascade reset downstream selections
    setSelectedDistrict(null);
    setSelectedBranch(null);
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setDistricts([]);
    setBranches([]);
    setHospitals([]);
    setDoctors([]);
    setSlots([]);

    fetchDistricts(city.id);
    setStep(2);
  };

  const handleDistrictSelect = (district) => {
    setPageOffset(0);
    setSelectedDistrict(district);
    // Cascade reset downstream selections
    setSelectedBranch(null);
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setBranches([]);
    setHospitals([]);
    setDoctors([]);
    setSlots([]);

    fetchBranches();
    setStep(3);
  };

  const handleBranchSelect = async (branch) => {
    setPageOffset(0);
    setSelectedBranch(branch);
    // Cascade reset downstream selections
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setHospitals([]);
    setDoctors([]);
    setSlots([]);

    const data = await fetchHospitals(selectedCity.id, selectedDistrict.id, branch.id);
    setHospitals(data);
    setStep(4);
  };

  const handleHospitalSelect = (hospital) => {
    setPageOffset(0);
    setSelectedHospital(hospital);
    // Cascade reset downstream selections
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setDoctors([]);
    setSlots([]);

    fetchDoctors(hospital.id, selectedBranch.id);
    setStep(5);
  };

  const handleDoctorSelect = (doctor) => {
    setPageOffset(0);
    setSelectedDoctor(doctor);
    setSelectedSlot(null);
    setSlots([]);

    fetchSlots(doctor?.id, selectedHospital.id, selectedBranch.id);
    setStep(6);
  };

  const handleSlotSelect = (slot) => {
    setPageOffset(0);
    setSelectedSlot(slot);
    setStep(7);
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    try {
      const userDataStr = await AsyncStorage.getItem('user');
      const userObj = JSON.parse(userDataStr || '{}');

      const response = await apiClient.post('/appointments/book', {
        doctor_id: selectedSlot.doctor_id,
        doctor_name: selectedSlot.doctor_name,
        date: selectedSlot.date,
        time: selectedSlot.time,
        hospital_id: selectedSlot.hospital_id,
        hospital_name: selectedSlot.hospital_name,
        branch_id: selectedSlot.branch_id,
        branch_name: selectedSlot.branch_name,
        patient_tc: userObj.tc || '11111111111',
        patient_name: userObj.name || 'Bilinmeyen Hasta',
        slot_id: selectedSlot.id,
      });

      if (response.data.success) {
        const successMsg = 'Randevunuz başarıyla oluşturuldu.';
        Alert.alert('Başarılı', successMsg, [
          { text: 'Tamam', onPress: () => setScreen('myAppointments') },
        ]);
        if (accessibilitySettings?.voiceGuide) {
          voiceService.speak(successMsg);
        }
      } else {
        Alert.alert('Hata', response.data.message || 'Randevu alınamadı.');
      }
    } catch (e) {
      handleApiError(e, 'Randevu oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const goBackStep = () => {
    setPageOffset(0);
    if (step > 1) {
      setStep(step - 1);
    } else {
      setScreen('home');
    }
  };

  // ─── Voice Assistant and Routing Logic ─────────────────────────────────

  const getStepName = (s) => {
    switch (s) {
      case 1: return 'city';
      case 2: return 'district';
      case 3: return 'branch';
      case 4: return 'hospital';
      case 5: return 'doctor';
      case 6: return 'slot';
      case 7: return 'confirm';
      default: return 'city';
    }
  };

  const getStepTitle = (s) => {
    switch (s) {
      case 1: return 'Şehir seçimi';
      case 2: return 'İlçe seçimi';
      case 3: return 'Branş seçimi';
      case 4: return 'Hastane seçimi';
      case 5: return 'Doktor seçimi';
      case 6: return 'Saat seçimi';
      case 7: return 'Randevu Onayı';
      default: return '';
    }
  };

  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replaceAll("ı", "i")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c")
      .replace(/[^\w\s]/g, "");
  };

  const handleLogout = async () => {
    console.log('[AppointmentScreen] handleLogout initiated');
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

  const getFormattedOptions = () => {
    let rawList = [];
    switch (step) {
      case 1: rawList = cities; break;
      case 2: rawList = districts; break;
      case 3: rawList = branches; break;
      case 4: rawList = hospitals; break;
      case 5: rawList = doctors; break;
      case 6: rawList = slots; break;
      default: break;
    }
    
    return rawList.map((item, idx) => {
      let label = '';
      if (step === 6) {
        label = `saat ${item.time}`;
      } else {
        label = item.name || '';
      }
      return {
        number: idx + 1,
        label: label,
        value: item
      };
    });
  };

  const speakOptions = async (stepTitle, optionsList, offset = 0) => {
    if (step === 7) {
      if (selectedSlot) {
        const confirmMsg = `${selectedBranch?.name} branşında, ${selectedHospital?.name} hastanesinde, ${selectedSlot?.doctor_name} hekiminden, ${selectedSlot?.date} günü saat ${selectedSlot?.time} için randevu almak istiyorsunuz. Onaylıyor musunuz? Evet veya hayır deyin.`;
        await voiceService.speak(confirmMsg, () => {
          startListeningForCurrentStep();
        }, true);
      }
      return;
    }

    if (optionsList.length === 0) {
      const emptyMsg = `${stepTitle} için uygun seçenek bulunamadı. Önceki adıma dönmek için geri diyebilirsiniz.`;
      await voiceService.speak(emptyMsg, () => {
        startListeningForCurrentStep();
      }, true);
      return;
    }

    const chunk = optionsList.slice(offset, offset + 5);
    let text = `${stepTitle}. `;
    
    if (step === 1 && offset === 0) {
      text = `Hastane randevusu ekranındasınız. ${stepTitle}. `;
    }

    chunk.forEach((opt) => {
      // Speak the index number relative to its display on screen (1-5)
      const visualNum = opt.number - offset;
      text += `${visualNum} ${opt.label}, `;
    });

    if (optionsList.length > offset + 5) {
      text += "Daha fazlası için devam deyin. ";
    }
    
    if (step === 5) {
      text += "Doktor isimleri uzun olabilir, seçmek için numara söyleyebilirsiniz. ";
    }
    
    text += "Seçmek için seçenek adını veya numarasını söyleyin.";

    await voiceService.speak(text, () => {
      startListeningForCurrentStep();
    }, true);
  };

  const findMatchingOption = (transcript, optionsList, offset = 0) => {
    const normalized = normalizeText(transcript);
    const chunk = optionsList.slice(offset, offset + 5);

    const TurkishNumberMap = {
      "bir": 1, "birinci": 1, "1": 1, "1.": 1, "numara bir": 1,
      "iki": 2, "ikinci": 2, "2": 2, "2.": 2, "numara iki": 2,
      "uc": 3, "ucuncu": 3, "3": 3, "3.": 3, "numara uc": 3, "üç": 3, "üçüncü": 3, "numara üç": 3,
      "dort": 4, "dorduncu": 4, "4": 4, "4.": 4, "numara dort": 4, "dördüncü": 4, "numara dört": 4,
      "bes": 5, "besinci": 5, "5": 5, "5.": 5, "numara bes": 5, "beşinci": 5, "numara beş": 5
    };

    let matchedNum = -1;
    for (const key of Object.keys(TurkishNumberMap)) {
      if (normalized === key || normalized.includes(key)) {
        matchedNum = TurkishNumberMap[key];
        break;
      }
    }

    if (matchedNum >= 1 && matchedNum <= 5) {
      const targetIdx = offset + (matchedNum - 1);
      if (targetIdx < optionsList.length) {
        return optionsList[targetIdx];
      }
    }

    // Exact match on label
    const exactMatch = chunk.find(opt => normalizeText(opt.label) === normalized);
    if (exactMatch) return exactMatch;

    // Partial match in currently visible chunk
    const chunkPartialMatch = chunk.find(opt => 
      normalized.includes(normalizeText(opt.label)) || 
      normalizeText(opt.label).includes(normalized)
    );
    if (chunkPartialMatch) return chunkPartialMatch;

    // Special slots time fallback match
    if (step === 6) {
      const slotTimeMatch = chunk.find(opt => {
        const timeStr = opt.value.time;
        const cleanTime = timeStr.replace(":", "");
        const cleanTranscript = normalized.replace(" ", "").replace(":", "");
        
        if (cleanTranscript.includes("dokuz") || cleanTranscript.includes("0900") || cleanTranscript.includes("9")) {
          if (timeStr.startsWith("09:") || timeStr.startsWith("9:")) return true;
        }
        if (cleanTranscript.includes("on otuz") || cleanTranscript.includes("1030") || cleanTranscript.includes("10:30")) {
          if (timeStr.startsWith("10:30")) return true;
        }
        if (cleanTranscript.includes("on dort") || cleanTranscript.includes("1400") || cleanTranscript.includes("14")) {
          if (timeStr.startsWith("14:")) return true;
        }
        return cleanTranscript.includes(cleanTime) || cleanTranscript.includes(timeStr);
      });
      if (slotTimeMatch) return slotTimeMatch;
    }

    return null;
  };

  const executeSelection = async (value) => {
    switch (step) {
      case 1:
        handleCitySelect(value);
        break;
      case 2:
        handleDistrictSelect(value);
        break;
      case 3:
        await handleBranchSelect(value);
        break;
      case 4:
        handleHospitalSelect(value);
        break;
      case 5:
        handleDoctorSelect(value);
        break;
      case 6:
        handleSlotSelect(value);
        break;
      default:
        break;
    }
  };

  const handleVoiceInput = async (transcript) => {
    if (isProcessing.current) {
      console.log("[Voice Command] Already processing, ignoring:", transcript);
      return;
    }
    isProcessing.current = true;
    voiceService.stopListening();

    try {
      const normalized = normalizeText(transcript);
      console.log("Current voice step:", getStepName(step));
      console.log("Transcript:", transcript);

      if (normalized === lastTranscript.current) {
        console.log("[Voice Command] Duplicate transcript, ignoring:", transcript);
        isProcessing.current = false;
        startListeningForCurrentStep();
        return;
      }
      lastTranscript.current = normalized;

      // Handle navigation/system commands first
      if (normalized === 'geri' || normalized === 'geri don' || normalized === 'geri git' || normalized === 'iptal') {
        goBackStep();
        isProcessing.current = false;
        return;
      }
      if (normalized === 'ana sayfa' || normalized === 'home') {
        setScreen('home');
        isProcessing.current = false;
        return;
      }
      if (normalized === 'cikis' || normalized === 'cikis yap') {
        await handleLogout();
        isProcessing.current = false;
        return;
      }
      if (normalized === 'tekrar et' || normalized === 'tekrar') {
        const stepTitle = getStepTitle(step);
        const opts = getFormattedOptions();
        await speakOptions(stepTitle, opts, pageOffset);
        isProcessing.current = false;
        return;
      }
      if (normalized === 'devam' || normalized === 'devam et' || normalized === 'sonraki') {
        const opts = getFormattedOptions();
        if (pageOffset + 5 < opts.length) {
          const newOffset = pageOffset + 5;
          setPageOffset(newOffset);
          const stepTitle = getStepTitle(step);
          await speakOptions(stepTitle, opts, newOffset);
        } else {
          await voiceService.speak("Başka seçenek kalmadı. Baştan dinlemek için tekrar et diyebilirsiniz.", () => {
            startListeningForCurrentStep();
          }, true);
        }
        isProcessing.current = false;
        return;
      }

      if (step === 7) {
        if (normalized.includes("evet") || normalized.includes("onayla") || normalized.includes("onayliyorum") || normalized.includes("kabul")) {
          await handleConfirmBooking();
        } else if (normalized.includes("hayir") || normalized.includes("iptal") || normalized.includes("geri")) {
          goBackStep();
          await voiceService.speak("Randevu onaylama iptal edildi, önceki adıma dönüldü.", null, true);
        } else {
          await voiceService.speak("Lütfen evet veya hayır diyerek randevuyu onaylayın.", () => {
            startListeningForCurrentStep();
          }, true);
        }
        isProcessing.current = false;
        return;
      }

      // Match step options
      const opts = getFormattedOptions();
      const matchedOpt = findMatchingOption(transcript, opts, pageOffset);

      if (matchedOpt) {
        console.log("Matched option:", matchedOpt);
        await executeSelection(matchedOpt.value);
      } else {
        console.log("No match found for:", transcript);
        await voiceService.speak("Söylediğinizi eşleştiremedim. Lütfen tekrar deneyin.", () => {
          startListeningForCurrentStep();
        }, true);
      }
    } catch (e) {
      console.error("[Voice Command Error]", e);
    } finally {
      isProcessing.current = false;
    }
  };

  const startListeningForCurrentStep = () => {
    const currentStepName = getStepName(step);
    console.log('[AppointmentScreen] Starting listening for step:', currentStepName);
    voiceService.startListening(
      (text) => handleVoiceInput(text),
      () => {},
      (err) => console.log('[AppointmentScreen Voice Error]', err),
      () => console.log('[AppointmentScreen Voice Started]')
    );
  };

  useEffect(() => {
    if (loading) {
      voiceService.stopListening();
      return;
    }

    const currentStepTitle = getStepTitle(step);
    const opts = getFormattedOptions();

    if (accessibilitySettings?.voiceGuide) {
      speakOptions(currentStepTitle, opts, pageOffset);
    } else {
      startListeningForCurrentStep();
    }

    return () => {
      voiceService.stopListening();
    };
  }, [step, loading, cities.length, districts.length, branches.length, hospitals.length, doctors.length, slots.length, pageOffset]);

  const renderStepContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    switch (step) {
      case 1:
        return (
          <View>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              Şehir Seçin
            </Text>
            <FlatList
              data={cities}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                    Uygun şehir bulunamadı.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleCitySelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <Text style={[styles.itemText, { color: colors.text, fontSize: fontSizes.medium }]}>
                    {item.name}
                  </Text>
                  <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              İlçe Seçin
            </Text>
            <FlatList
              data={districts}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                    Bu şehre ait uygun ilçe bulunamadı.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleDistrictSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <Text style={[styles.itemText, { color: colors.text, fontSize: fontSizes.medium }]}>
                    {item.name}
                  </Text>
                  <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              Branş / Klinik Seçin
            </Text>
            <FlatList
              data={branches}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                    Uygun branş bulunamadı.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleBranchSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <Text style={[styles.itemText, { color: colors.text, fontSize: fontSizes.medium }]}>
                    {item.name}
                  </Text>
                  <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          </View>
        );
      case 4:
        return (
          <View>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              Hastane Seçin
            </Text>
            <FlatList
              data={hospitals}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium, textAlign: 'center' }]}>
                    Seçilen kriterlere uygun hastane bulunamadı.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleHospitalSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemText, { color: colors.text, fontSize: fontSizes.medium, fontWeight: 'bold' }]}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: fontSizes.small, marginTop: 4 }}>
                      {item.address}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          </View>
        );
      case 5:
        return (
          <View>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              Doktor Seçin
            </Text>
            {/* Fark Etmez Option */}
            <TouchableOpacity
              style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 }]}
              onPress={() => handleDoctorSelect(null)}
              accessibilityRole="button"
              accessibilityLabel="Fark etmez, herhangi bir doktordan randevu al"
            >
              <View style={[styles.farkEtmezIcon, { backgroundColor: colors.background }]}>
                <MaterialIcons name="people" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.itemText, { color: colors.primary, fontSize: fontSizes.medium, fontWeight: 'bold' }]}>
                  Fark Etmez
                </Text>
                <Text style={{ color: colors.muted, fontSize: fontSizes.small, marginTop: 2 }}>
                  Tüm doktorların müsait randevu saatlerini listeler
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>

            <FlatList
              data={doctors}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium, textAlign: 'center' }]}>
                    Bu hastanede ve branşta uygun doktor bulunamadı.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleDoctorSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title || 'Dr.'} ${item.full_name}`}
                >
                  <Text style={[styles.itemText, { color: colors.text, fontSize: fontSizes.medium }]}>
                    {item.title || 'Dr.'} {item.full_name}
                  </Text>
                  <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          </View>
        );
      case 6:
        return (
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              Randevu Saati Seçin
            </Text>
            {slots.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="event-busy" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                  En yakın uygun slot bulunmamaktadır.
                </Text>
              </View>
            ) : (
              <FlatList
                data={slots}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                  const dayStr = item.date.split('-')[2];
                  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
                  const monthStr = months[parseInt(item.date.split('-')[1]) - 1];
                  const label = `${item.doctor_name}, ${dayStr} ${monthStr} saat ${item.time}`;
                  return (
                    <TouchableOpacity
                      style={[styles.slotCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => handleSlotSelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                    >
                      <View style={styles.slotLeft}>
                        <MaterialIcons name="schedule" size={24} color={colors.primary} />
                        <Text style={[styles.slotTime, { color: colors.text, fontSize: fontSizes.large }]}>
                          {item.time}
                        </Text>
                      </View>
                      <View style={styles.slotRight}>
                        <Text style={[styles.slotDoc, { color: colors.text, fontSize: fontSizes.medium }]}>
                          {item.doctor_name}
                        </Text>
                        <Text style={[styles.slotDate, { color: colors.muted, fontSize: fontSizes.small }]}>
                          {dayStr} {monthStr} {item.date.split('-')[0]}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        );
      case 7:
        return (
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card }]}>
            <Text style={[styles.summaryTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              Randevu Özeti
            </Text>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>Şehir / İlçe:</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontSize: fontSizes.medium }]}>
                {selectedCity?.name} / {selectedDistrict?.name}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>Klinik / Branş:</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontSize: fontSizes.medium }]}>
                {selectedBranch?.name}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>Hastane:</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontSize: fontSizes.medium }]}>
                {selectedHospital?.name}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>Doktor:</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontSize: fontSizes.medium }]}>
                {selectedSlot?.doctor_name}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: fontSizes.medium }]}>Tarih & Saat:</Text>
              <Text style={[styles.summaryValue, { color: colors.primary, fontSize: fontSizes.medium, fontWeight: 'bold' }]}>
                {selectedSlot?.date.split('-')[2]}.{selectedSlot?.date.split('-')[1]}.{selectedSlot?.date.split('-')[0]} - {selectedSlot?.time}
              </Text>
            </View>

            <AccessibleButton
              title="Randevuyu Onayla ve Al"
              onPress={handleConfirmBooking}
              style={{ marginTop: 24 }}
              accessibilityLabel="Randevuyu onayla ve al"
              accessibilityHint="Randevuyu oluşturmak ve onaylamak için çift tıklayın"
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Navigation top bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBackStep}
            accessibilityRole="button"
            accessibilityLabel="Geri git"
            accessibilityHint="Bir önceki adıma döner"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text, fontSize: fontSizes.large }]}>
              Geri
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected Items summary top panel */}
        {step > 1 && (
          <View style={[styles.topSummaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: fontSizes.small }}>
              Seçilenler: {[
                selectedCity?.name,
                selectedDistrict?.name,
                selectedBranch?.name,
                selectedHospital?.name,
                selectedDoctor ? selectedDoctor.full_name : (step > 5 ? 'Fark Etmez' : null),
              ].filter(Boolean).join(' ➔ ')}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>{renderStepContent()}</View>
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
    marginBottom: 16,
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
  topSummaryBar: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  stepTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
    elevation: 1,
  },
  itemText: {
    flex: 1,
    fontWeight: '600',
  },
  farkEtmezIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotCard: {
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
  slotTime: {
    fontWeight: 'bold',
  },
  slotRight: {
    flex: 1,
    marginLeft: 16,
  },
  slotDoc: {
    fontWeight: 'bold',
  },
  slotDate: {
    marginTop: 2,
  },
  card: {
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  summaryTitle: {
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 1.5,
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontWeight: '500',
  },
  summaryValue: {
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
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
  },
});
