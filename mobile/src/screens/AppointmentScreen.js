import React, { useState, useEffect, useRef, Component } from 'react';
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

class AppointmentScreenErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[AppointmentScreen Error Boundary Caught]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red', marginBottom: 10 }}>Bir hata oluştu.</Text>
          <Text style={{ fontSize: 14, color: 'gray', textAlign: 'center' }}>
            {this.state.error?.toString()}
          </Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function AppointmentScreenContent({ setScreen, accessibilitySettings }) {
  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  const [step, setStep] = useState(1); // 1: City, 2: District, 3: Branch, 4: Hospital, 5: Doctor, 6: Slot, 7: Confirm
  const [historyStack, setHistoryStack] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const lastSpokenContext = useRef('');

  // Selections
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null); // { id, name } or null (Fark etmez)
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

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
  const lastCommandTime = React.useRef(0);

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  // Helper to filter slots >= today's current date and time
  const getFilteredSlots = (allSlots) => {
    if (!allSlots) return [];
    const now = new Date();
    // Use ISO string format YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    return allSlots.filter(slot => {
      if (!slot.date) return false;
      if (slot.date < todayStr) {
        return false;
      }
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

  // Extract sorted unique dates from filtered slots
  const getUniqueDates = () => {
    const filtered = getFilteredSlots(slots);
    const dates = [...new Set(filtered.map(s => s.date))];
    dates.sort();
    return dates;
  };

  // Extract slots matching the selectedDate
  const getFilteredSlotsForSelectedDate = () => {
    const filtered = getFilteredSlots(slots);
    return filtered.filter(s => s.date === selectedDate);
  };

  const formatTurkishDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const month = months[monthIdx] || '';
    return `${day} ${month}`;
  };

  const formatTurkishDateWithRelative = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const formatted = formatTurkishDate(dateStr);
    if (dateStr === todayStr) {
      return `bugün, ${formatted}`;
    } else if (dateStr === tomorrowStr) {
      return `yarın, ${formatted}`;
    }
    return formatted;
  };

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

  const advanceStep = (nextStep) => {
    setHistoryStack(prev => [...prev, step]);
    setStep(nextStep);
  };

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

  const handleCitySelect = async (city) => {
    setPageOffset(0);
    setSelectedCity(city);
    setSelectedDistrict(null);
    setSelectedBranch(null);
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setDistricts([]);
    setBranches([]);
    setHospitals([]);
    setDoctors([]);
    setSlots([]);

    setLoading(true);
    try {
      const response = await apiClient.get(`/locations/districts?city_id=${city.id}`);
      setDistricts(response.data || []);
      advanceStep(2);
    } catch (e) {
      handleApiError(e, 'İlçeler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDistrictSelect = async (district) => {
    setPageOffset(0);
    setSelectedDistrict(district);
    setSelectedBranch(null);
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setBranches([]);
    setHospitals([]);
    setDoctors([]);
    setSlots([]);

    setLoading(true);
    try {
      const response = await apiClient.get('/branches');
      setBranches(response.data || []);
      advanceStep(3);
    } catch (e) {
      handleApiError(e, 'Branşlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSelect = async (branch) => {
    setPageOffset(0);
    setSelectedBranch(branch);
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setHospitals([]);
    setDoctors([]);
    setSlots([]);

    setLoading(true);
    try {
      const response = await apiClient.get(
        `/hospitals?city_id=${selectedCity.id}&district_id=${selectedDistrict.id}&branch_id=${branch.id}`
      );
      let hospitalList = [];
      if (Array.isArray(response.data)) {
        hospitalList = response.data;
      } else if (response.data && Array.isArray(response.data.hospitals)) {
        hospitalList = response.data.hospitals;
      } else if (response.data && Array.isArray(response.data.value)) {
        hospitalList = response.data.value;
      }
      setHospitals(hospitalList);
      advanceStep(4);
    } catch (e) {
      handleApiError(e, 'Hastaneler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalSelect = async (hospital) => {
    setPageOffset(0);
    setSelectedHospital(hospital);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setDoctors([]);
    setSlots([]);

    setLoading(true);
    try {
      const response = await apiClient.get(
        `/doctors?hospital_id=${hospital.id}&branch_id=${selectedBranch.id}`
      );
      setDoctors(response.data || []);
      advanceStep(5);
    } catch (e) {
      handleApiError(e, 'Doktorlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSelect = async (doctor) => {
    setPageOffset(0);
    setSelectedDoctor(doctor);
    setSelectedSlot(null);
    setSelectedDate(null);
    setSlots([]);

    setLoading(true);
    try {
      let url = `/appointments/slots?hospital_id=${selectedHospital.id}&branch_id=${selectedBranch.id}`;
      if (doctor?.id) {
        url += `&doctor_id=${doctor.id}`;
      }
      const response = await apiClient.get(url);
      const fetchedSlots = response.data || [];
      setSlots(fetchedSlots);
      
      const filtered = getFilteredSlots(fetchedSlots);
      const dates = [...new Set(filtered.map(s => s.date))];
      dates.sort();
      
      if (dates.length > 0) {
        advanceStep(6);
      } else {
        await voiceService.speak("Uygun randevu tarihi bulunamadı.", () => {
          startListeningForCurrentStep();
        }, true);
      }
    } catch (e) {
      handleApiError(e, 'Uygun randevu saatleri yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (dateStr) => {
    setPageOffset(0);
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    advanceStep(7);
  };

  const handleSlotSelect = (slot) => {
    setPageOffset(0);
    setSelectedSlot(slot);
    advanceStep(8);
  };

  const handleConfirmBooking = async () => {
    if (isBooking) return;
    setIsBooking(true);
    setLoading(true);
    voiceService.stopListening();
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
        await voiceService.speak(successMsg, () => {
          setScreen('myAppointments');
        }, true);
      } else {
        throw new Error(response.data.message || 'Bu randevu saati dolu');
      }
    } catch (e) {
      console.error('[Confirm Booking Error]', e);
      const isSlotFull = e.response?.status === 400 || e.message?.includes('dolu');
      
      const errorMsg = isSlotFull ? 'Bu saat artık dolu. Lütfen başka bir saat seçin.' : 'Randevu oluşturulamadı. Lütfen tekrar deneyin.';
      const voiceMsg = isSlotFull ? 'Bu saat artık dolu. Yeni uygun saatler listeleniyor.' : 'Randevu oluşturulamadı.';
      
      Alert.alert('Hata', errorMsg);
      
      if (isSlotFull) {
        setSelectedSlot(null);
        await voiceService.speak(voiceMsg, () => {
          fetchSlots(selectedDoctor?.id, selectedHospital.id, selectedBranch.id).then(() => {
            setPageOffset(0);
            setStep(7);
          });
        }, true);
      } else {
        await voiceService.speak(voiceMsg, () => {
          startListeningForCurrentStep();
        }, true);
      }
    } finally {
      setLoading(false);
      setIsBooking(false);
    }
  };

  const goBackStep = () => {
    lastSpokenContext.current = '';
    setPageOffset(0);
    if (historyStack.length > 0) {
      const prevStep = historyStack[historyStack.length - 1];
      setHistoryStack(prev => prev.slice(0, -1));
      setStep(prevStep);
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
      case 6: return 'date';
      case 7: return 'slot';
      case 8: return 'confirm';
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
      case 6: return 'Tarih seçimi';
      case 7: return 'Uygun saatler';
      case 8: return 'Randevu Onayı';
      default: return '';
    }
  };

  const getCategoryNameForSpeech = (s) => {
    switch (s) {
      case 1: return 'şehirler';
      case 2: return 'ilçeler';
      case 3: return 'branşlar';
      case 4: return 'hastaneler';
      case 5: return 'doktorlar';
      case 6: return 'tarihler';
      case 7: return 'saatler';
      default: return 'seçenekler';
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
      case 6: {
        rawList = getUniqueDates().map(d => ({ name: d, dateStr: d }));
        break;
      }
      case 7: {
        rawList = getFilteredSlotsForSelectedDate();
        break;
      }
      default: break;
    }
    
    let formatted = [];
    if (!Array.isArray(rawList)) {
      rawList = [];
    }

    if (step === 5) {
      formatted.push({
        number: 1,
        label: 'Fark etmez',
        value: null
      });
      rawList.forEach((item, idx) => {
        formatted.push({
          number: idx + 2,
          label: `Doktor ${item.full_name}`,
          value: item
        });
      });
    } else if (step === 6) {
      rawList.forEach((item, idx) => {
        formatted.push({
          number: idx + 1,
          label: formatTurkishDateWithRelative(item.dateStr),
          value: item.dateStr
        });
      });
    } else if (step === 7) {
      rawList.forEach((item, idx) => {
        formatted.push({
          number: idx + 1,
          label: `Saat ${item.time}`,
          value: item
        });
      });
    } else {
      rawList.forEach((item, idx) => {
        formatted.push({
          number: idx + 1,
          label: item.name || '',
          value: item
        });
      });
    }
    return formatted;
  };

  const buildOptionsPrompt = (currentStep, optionsList, offset) => {
    if (currentStep === 8) {
      return `Randevunuz ${selectedHospital?.name || ''}, ${selectedBranch?.name || ''}, Doktor ${selectedDoctor?.full_name || ''}, saat ${selectedSlot?.time || ''} için oluşturulacak. Onaylıyor musunuz?`;
    }
    
    if (!optionsList || optionsList.length === 0) {
      return '';
    }

    let text = '';
    const isFirstPage = offset === 0;
    
    if (currentStep === 1) text = isFirstPage ? "Şehir seçimi. Bulunan şehirler: " : "Diğer şehirler: ";
    else if (currentStep === 2) text = isFirstPage ? "İlçe seçimi. Bulunan ilçeler: " : "Diğer ilçeler: ";
    else if (currentStep === 3) text = isFirstPage ? "Branş seçimi. Bulunan branşlar: " : "Diğer branşlar: ";
    else if (currentStep === 4) text = isFirstPage ? "Hastane seçimi. Bulunan hastaneler: " : "Diğer hastaneler: ";
    else if (currentStep === 5) text = isFirstPage ? "Doktor seçimi. Bulunan doktorlar: " : "Diğer doktorlar: ";
    else if (currentStep === 6) text = isFirstPage ? "Tarih seçimi. Bulunan tarihler: " : "Diğer tarihler: ";
    else if (currentStep === 7) text = isFirstPage ? "Saat seçimi. Uygun saatler: " : "Diğer saatler: ";

    const chunk = optionsList.slice(offset, offset + 5);
    chunk.forEach((opt) => {
      const visualNum = opt.number - offset; // Always 1 to 5 for users
      text += `${visualNum} ${opt.label}. `;
    });

    if (optionsList.length > offset + 5) {
      text += "Sonraki seçenekler için devam deyin. ";
    }

    if (currentStep === 5) {
      text += "Doktor isimleri uzun olabilir, numara söyleyebilirsiniz.";
    } else if (currentStep === 7) {
      text += "Saat numarasını söyleyin.";
    } else {
      text += "Seçmek için adını veya numarasını söyleyin.";
    }

    return text;
  };

  const triggerStepAnnouncement = async () => {
    voiceService.stopListening();
    const opts = getFormattedOptions();
    
    const prompt = buildOptionsPrompt(step, opts, pageOffset);
    console.log('[VOICE]', 'Step:', step, 'Options:', opts.length);
    console.log('[VOICE]', 'Generated Prompt:', prompt);

    if (opts.length === 0 && step !== 8 && !loading) {
      // API has not returned data yet, or it's genuinely empty.
      // If genuinely empty, we shouldn't get stuck.
      // But let's let the user know if they try to repeat
      return;
    }

    if (prompt) {
      const currentContext = `step_${step}_offset_${pageOffset}_len_${opts.length}`;
      if (lastSpokenContext.current === currentContext) {
        console.log('[VOICE] Already spoken this context, skipping speak.');
        startListeningForCurrentStep();
        return;
      }
      lastSpokenContext.current = currentContext;

      await voiceService.speak(prompt, () => {
        startListeningForCurrentStep();
      }, true);
    } else {
      startListeningForCurrentStep();
    }
  };

  const findMatchingOption = (transcript, optionsList, offset = 0) => {
    const normalized = normalizeText(transcript);
    const tokens = normalized.split(/\s+/);
    const chunk = optionsList.slice(offset, offset + 5);

    // 1. Strict Slot Time Match (Step 7)
    if (step === 7) {
      const cleanTranscript = normalized.replace(/\s+/g, "").replace(/:/g, "");
      const exactTimeMatch = chunk.find(opt => {
        if (!opt.value) return false;
        const timeStr = opt.value.time; // e.g. "15:00"
        const hours = timeStr.split(':')[0]; // "15"
        const cleanTime = timeStr.replace(":", ""); // "1500"
        
        // Exact "1500" or matching hours
        return cleanTranscript === cleanTime || cleanTranscript.includes(cleanTime) || 
               cleanTranscript === hours || cleanTranscript === `saat${hours}`;
      });
      if (exactTimeMatch) return exactTimeMatch;
    }

    // 2. Strict Exact Label Match
    const exactMatch = chunk.find(opt => normalizeText(opt.label) === normalized);
    if (exactMatch) return exactMatch;

    // 3. Fallback to Number Matching
    const TurkishNumberMap = {
      "bir": 1, "birinci": 1, "1": 1, "1.": 1, "numara bir": 1,
      "iki": 2, "ikinci": 2, "2": 2, "2.": 2, "numara iki": 2,
      "uc": 3, "ucuncu": 3, "3": 3, "3.": 3, "numara uc": 3, "üç": 3, "üçüncü": 3, "numara üç": 3,
      "dort": 4, "dorduncu": 4, "4": 4, "4.": 4, "numara dort": 4, "dördüncü": 4, "numara dört": 4,
      "bes": 5, "besinci": 5, "5": 5, "5.": 5, "numara bes": 5, "beşinci": 5, "numara beş": 5
    };

    let matchedNum = -1;
    for (const key of Object.keys(TurkishNumberMap)) {
      // Must match whole word to prevent "15" triggering "1"
      if (normalized === key || tokens.includes(key)) {
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

    // 4. Fallback for "en yakın tarih"
    if (step === 6) {
      if (normalized.includes("en yakin") || normalized.includes("yakin") || normalized.includes("ilk")) {
        if (optionsList.length > 0) {
          return optionsList[0];
        }
      }
    }

    // 5. Partial match in currently visible chunk
    const chunkPartialMatch = chunk.find(opt => {
      const normLabel = normalizeText(opt.label);
      if (!normalized || !normLabel) return false;
      return normalized.includes(normLabel) || normLabel.includes(normalized);
    });
    if (chunkPartialMatch) return chunkPartialMatch;

    return null;
  };

  const executeSelection = async (value) => {
    switch (step) {
      case 1:
        await handleCitySelect(value);
        break;
      case 2:
        await handleDistrictSelect(value);
        break;
      case 3:
        await handleBranchSelect(value);
        break;
      case 4:
        await handleHospitalSelect(value);
        break;
      case 5:
        await handleDoctorSelect(value);
        break;
      case 6:
        handleDateSelect(value);
        break;
      case 7:
        handleSlotSelect(value);
        break;
      default:
        break;
    }
  };

  const handleVoiceInput = async (transcript) => {
    console.log(`[VOICE] Step: ${step} | Transcript: '${transcript}'`);
    
    if (!transcript || transcript.trim() === '') {
      console.log("[Voice Command] Empty transcript, ignoring silently.");
      // If STT stopped and returned empty, we just restart listening without error speech
      startListeningForCurrentStep();
      return;
    }

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

      const now = Date.now();
      if (normalized === lastTranscript.current && (now - lastCommandTime.current) < 2000) {
        console.log("[Voice Command] Duplicate transcript within 2s, ignoring:", transcript);
        isProcessing.current = false;
        startListeningForCurrentStep();
        return;
      }
      lastTranscript.current = normalized;
      lastCommandTime.current = now;

      // Handle global voice commands FIRST (ses aç, ses kapat, yardım, vs)
      if (voiceService.handleGlobalCommand(transcript, setScreen)) {
        isProcessing.current = false;
        return;
      }

      // Handle navigation/system commands
      const isHomeCommand = ['ana sayfa', 'anasayfa', 'ana menu', 'menuye don', 'basa don'].some(cmd => normalized === cmd || normalized.includes(cmd));
      if (isHomeCommand) {
        setScreen('home');
        isProcessing.current = false;
        return;
      }

      const isBackCommand = ['geri', 'onceki', 'geri don'].some(cmd => normalized === cmd || normalized.includes(cmd));
      if (isBackCommand) {
        goBackStep();
        isProcessing.current = false;
        return;
      }
      
      const isAnotherDayCommand = ['baska gun', 'baska tarih', 'farkli gun', 'farkli tarih'].some(cmd => normalized.includes(cmd));
      if (isAnotherDayCommand) {
        if (step === 7) {
          setSelectedDate(null);
          setSelectedSlot(null);
          setPageOffset(0);
          setHistoryStack(prev => prev.filter(p => p !== 6)); // ensure 6 is not duplicated
          advanceStep(6);
        } else {
          await voiceService.speak("Başka gün seçimi sadece saat seçimi ekranında yapılabilir.", () => {
            startListeningForCurrentStep();
          }, true);
        }
        isProcessing.current = false;
        return;
      }

      if (normalized === 'iptal') {
        goBackStep();
        isProcessing.current = false;
        return;
      }
      
      if (step === 8) {
        console.log("[Confirm Check] Transcript:", transcript);
        console.log("[Confirm Check] Selected slot:", selectedSlot);
        const confirmCommands = ['evet', 'onayliyorum', 'onayla', 'tamam', 'olur', 'olumlu'];
        const isConfirm = confirmCommands.some(cmd => normalized === cmd || normalized.includes(cmd));
        if (isConfirm) {
          handleConfirmBooking();
          isProcessing.current = false;
          return;
        } else if (['hayir', 'iptal', 'geri'].some(cmd => normalized === cmd || normalized.includes(cmd))) {
          goBackStep();
          isProcessing.current = false;
          return;
        } else {
          await voiceService.speak("Lütfen evet veya hayır deyin.", () => {
            startListeningForCurrentStep();
          }, true);
          isProcessing.current = false;
          return;
        }
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
      if (normalized === 'tekrar et' || normalized === 'tekrar' || normalized === 'yardim' || normalized === 'secenekleri soyle') {
        lastSpokenContext.current = '';
        await triggerStepAnnouncement();
        isProcessing.current = false;
        return;
      }
      if (normalized === 'devam' || normalized === 'devam et' || normalized === 'sonraki') {
        const opts = getFormattedOptions();
        if (pageOffset + 5 < opts.length) {
          setPageOffset(pageOffset + 5);
        } else {
          await voiceService.speak("Başka seçenek kalmadı. Baştan dinlemek için tekrar et diyebilirsiniz.", () => {
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
        const fallbackMsg = step === 7 
          ? "Bu saat için uygun randevu bulunamadı. Mevcut saatleri tekrar okuyorum."
          : "Anlayamadım. Lütfen seçeneklerden birini söyleyin.";

        await voiceService.speak(fallbackMsg, () => {
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

    triggerStepAnnouncement();

    return () => {
      voiceService.stopListening();
    };
  }, [step, loading, pageOffset, cities.length, districts.length, branches.length, hospitals.length, doctors.length, slots.length]);

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
              Randevu Tarihi Seçin
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
                renderItem={({ item, index }) => {
                  const label = formatTurkishDateWithRelative(item);
                  return (
                    <TouchableOpacity
                      style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => handleDateSelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${index + 1} numara, ${label}`}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <MaterialIcons name="event" size={24} color={colors.primary} />
                        <Text style={[styles.itemText, { color: colors.text, fontSize: fontSizes.medium }]}>
                          {label}
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepTitle, { color: colors.text, fontSize: fontSizes.large }]}>
              Randevu Saati Seçin
            </Text>
            {getFilteredSlotsForSelectedDate().length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="schedule" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: fontSizes.medium }]}>
                  Seçilen tarih için uygun randevu saati bulunmamaktadır.
                </Text>
              </View>
            ) : (
              <FlatList
                data={getFilteredSlotsForSelectedDate()}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => {
                  const label = `${index + 1} numara, saat ${item.time}`;
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
                          {formatTurkishDateWithRelative(item.date)}
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
      case 8:
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
                {formatTurkishDate(selectedSlot?.date)} - {selectedSlot?.time}
              </Text>
            </View>

            <AccessibleButton
              title={isBooking ? "İşleniyor..." : "Randevuyu Onayla ve Al"}
              onPress={handleConfirmBooking}
              style={{ marginTop: 24 }}
              accessibilityLabel={isBooking ? "Randevunuz işleniyor, lütfen bekleyin" : "Randevuyu onayla ve al"}
              accessibilityHint="Randevuyu oluşturmak ve onaylamak için çift tıklayın"
              disabled={isBooking}
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

        {step > 1 && (
          <View style={[styles.topSummaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: fontSizes.small }}>
              Seçilenler: {[
                selectedCity?.name,
                selectedDistrict?.name,
                selectedBranch?.name,
                selectedHospital?.name,
                selectedDoctor ? selectedDoctor.full_name : (step > 5 ? 'Fark Etmez' : null),
                selectedDate ? formatTurkishDate(selectedDate) : null,
                selectedSlot ? selectedSlot.time : null
              ].filter(Boolean).join(' ➔ ')}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>{renderStepContent()}</View>
      </View>
    </SafeAreaView>
  );
}

export default function AppointmentScreen(props) {
  return (
    <AppointmentScreenErrorBoundary>
      <AppointmentScreenContent {...props} />
    </AppointmentScreenErrorBoundary>
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
