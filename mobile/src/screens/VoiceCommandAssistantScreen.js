import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { voiceService } from '../utils/speech';
import apiClient from '../api/api';
import { getTheme, radius } from '../styles/theme';
import { detectRecognitionMode } from '../utils/voiceRecognition';
import { isPresentationMode } from '../utils/buildConfig';
import AccessibleButton from '../components/AccessibleButton';

export default function VoiceCommandAssistantScreen({ setScreen, accessibilitySettings }) {
  const theme = getTheme(accessibilitySettings);
  const { colors, fontSizes } = theme;

  // State Machine Step
  // Steps: intro | askCity | askDistrict | askDepartment | askHospital | askDoctor | askSlot | confirm | success | error
  // FP Steps: askFpSlot | confirmFp
  const [currentStep, setCurrentStep] = useState('intro');
  const [stepHistory, setStepHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assistantText, setAssistantText] = useState('');
  const [recognizedText, setRecognizedText] = useState('');
  
  // Audio state feedback
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recognitionMode, setRecognitionMode] = useState('simulation'); // simulation | web | native

  // Dynamic Lists
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [fpInfo, setFpInfo] = useState(null);

  // User selections
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null); // null represents "Fark Etmez"
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  // Helper functions for Date Filtering
  const getFilteredSlots = (allSlots) => {
    if (!allSlots) return [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    return allSlots.filter(slot => {
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
    const filtered = getFilteredSlots(slots);
    const dates = [...new Set(filtered.map(s => s.date))];
    dates.sort();
    return dates;
  };

  const getFilteredSlotsForSelectedDate = () => {
    const filtered = getFilteredSlots(slots);
    return filtered.filter(s => s.date === selectedDate);
  };

  const formatTurkishDateWithRelative = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const formatted = formatDateTurkish(dateStr);
    if (dateStr === todayStr) {
      return `bugün, ${formatted}`;
    } else if (dateStr === tomorrowStr) {
      return `yarın, ${formatted}`;
    }
    return formatted;
  };

  // Pulse animation ref
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseTimer = useRef(null);

  // Setup platform recognition mode on mount
  useEffect(() => {
    voiceService.setScreen('voiceAssistant');

    const mode = detectRecognitionMode();
    setRecognitionMode(mode);

    // APK sunum: deneysel STT yalnızca bu ekranda
    if (isPresentationMode()) {
      voiceService.enableSttForExperimentalScreen(true);
    }

    return () => {
      voiceService.stopListening();
      if (isPresentationMode()) {
        voiceService.enableSttForExperimentalScreen(false);
      }
    };
  }, []);

  // Handle pulse visual animation
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // Main flow step voice assistant logic
  useEffect(() => {
    let speakPrompt = '';

    switch (currentStep) {
      case 'intro':
        speakPrompt =
          'Erişimli Randevu sesli asistanına hoş geldiniz. Hastane randevusu almak için "randevu al" diyebilir, aile hekimi randevusu için "aile hekimi" diyebilir veya kayıtlı randevuları listelemek için "randevularım" diyebilirsiniz. Ne yapmak istersiniz?';
        break;
      case 'askCity':
        speakPrompt = 'Hastane randevusu seçildi. Lütfen randevu almak istediğiniz şehri söyleyin.';
        break;
      case 'askDistrict':
        speakPrompt = 'Lütfen randevu almak istediğiniz ilçeyi söyleyin.';
        break;
      case 'askDepartment':
        speakPrompt = 'Hangi tıbbi branştan randevu almak istersiniz? Kardiyoloji, Dahiliye veya Göz Hastalıkları gibi bir branş adı söyleyin.';
        break;
      case 'askHospital':
        speakPrompt = 'Hangi hastaneyi tercih ediyorsunuz? Lütfen hastane adını söyleyin.';
        break;
      case 'askDoctor':
        speakPrompt = 'Belirli bir doktor seçmek istiyorsanız adını söyleyin. Doktor fark etmez demek için "fark etmez" deyin.';
        break;
      case 'askDate':
        if (getUniqueDates().length === 0) {
          speakPrompt = 'Üzgünüm, seçtiğiniz doktor ve hastanede uygun randevu tarihi bulunamadı. Başka bir hekim seçmek için "geri" diyebilirsiniz.';
        } else {
          speakPrompt = 'Müsait tarihler bulundu. Lütfen seçenek numaralarından birini söyleyin. Seçenekler şunlardır: ';
          getUniqueDates().slice(0, 5).forEach((d, idx) => {
            speakPrompt += `${idx + 1}. seçenek: ${formatTurkishDateWithRelative(d)}. `;
          });
        }
        break;
      case 'askSlot': {
        const validSlots = getFilteredSlotsForSelectedDate();
        if (validSlots.length === 0) {
          speakPrompt = 'Seçtiğiniz tarihte uygun saat bulunamadı. Başka bir tarih seçmek için "geri" diyebilirsiniz.';
        } else {
          speakPrompt = `${formatTurkishDateWithRelative(selectedDate)} için uygun saatler: `;
          validSlots.slice(0, 5).forEach((s, idx) => {
            speakPrompt += `${idx + 1}. seçenek: saat ${s.time}. `;
          });
        }
        break;
      }
      case 'confirm':
        speakPrompt = `${selectedBranch?.name} branşında, ${selectedHospital?.name} hastanesinde, ${selectedSlot?.doctor_name} isimli hekimden, ${formatDateTurkish(selectedSlot?.date)} günü saat ${selectedSlot?.time} için randevu almak istiyorsunuz. Onaylıyor musunuz? Evet veya hayır deyin.`;
        break;
      case 'askFpDate':
        if (getUniqueDates().length === 0) {
          speakPrompt = 'Üzgünüm, aile hekiminiz için uygun randevu tarihi bulunamadı. Daha sonra tekrar denemek için "ana sayfa" diyebilirsiniz.';
        } else {
          speakPrompt = 'Aile hekiminiz için uygun tarihler bulundu. Lütfen seçenek numaralarından birini söyleyin. Seçenekler: ';
          getUniqueDates().slice(0, 5).forEach((d, idx) => {
            speakPrompt += `${idx + 1}. seçenek: ${formatTurkishDateWithRelative(d)}. `;
          });
        }
        break;
      case 'askFpSlot': {
        const fpSlots = getFilteredSlotsForSelectedDate();
        if (fpSlots.length === 0) {
          speakPrompt = 'Seçtiğiniz tarihte aile hekiminiz için uygun saat bulunamadı. Lütfen "geri" deyin.';
        } else {
          speakPrompt = `${formatTurkishDateWithRelative(selectedDate)} için aile hekiminize uygun saatler: `;
          fpSlots.slice(0, 5).forEach((s, idx) => {
            speakPrompt += `${idx + 1}. seçenek: saat ${s.time}. `;
          });
        }
        break;
      }
      case 'confirmFp':
        speakPrompt = `Aile hekiminiz ${fpInfo?.doctor_name} için, ${formatDateTurkish(selectedSlot?.date)} günü saat ${selectedSlot?.time} randevusunu onaylıyor musunuz? Evet veya hayır deyin.`;
        break;
      case 'success':
        speakPrompt = 'Randevunuz başarıyla oluşturuldu. Erişimli Randevu sağlıklı günler diler.';
        break;
      case 'error':
        speakPrompt = 'Randevu oluşturulurken sistemsel hata oluştu. Tekrar denemek için "geri" deyin.';
        break;
      default:
        break;
    }

    if (speakPrompt) {
      setAssistantText(speakPrompt);
      setRecognizedText('');
      // Clear last spoken text cache to ensure that identical text (e.g. on navigating back) is still spoken
      voiceService.lastSpokenText = '';
      speakAndListen(speakPrompt);
    }
  }, [currentStep, slots.length]);

  // TTS speak and auto-trigger STT listening when finished
  const speakAndListen = async (text) => {
    try {
      setIsSpeaking(true);
      setIsListening(false);
      voiceService.stopListening();

      voiceService.speak(text, () => {
        setIsSpeaking(false);
        // Start listening after speaker finishes
        startVoiceRecognition();
      });
    } catch (e) {
      console.error('[Speak Error]', e);
      setIsSpeaking(false);
    }
  };

  const startVoiceRecognition = async () => {
    if (recognitionMode === 'simulation') {
      console.log('[STT] Simulation mode: voice input via buttons.');
      return;
    }
    try {
      setRecognizedText('Dinleniyor...');
      setIsListening(true);
      voiceService.startListening(
        (text) => {
          setRecognizedText(text);
          handleVoiceInput(text);
        },
        () => {
          setIsListening(false);
        },
        (err) => {
          console.log('[STT Error]', err);
          setIsListening(false);
        },
        () => {
          setIsListening(true);
        }
      );
    } catch (e) {
      console.error('[STT Start Error]', e?.message ?? e);
      setIsListening(false);
    }
  };

  // State state history navigation helper
  const navigateToStep = (nextStep, updateHistory = true) => {
    if (updateHistory) {
      setStepHistory((prev) => [...prev, currentStep]);
    }
    setCurrentStep(nextStep);
  };

  const handleGoBack = async () => {
    voiceService.stopListening();
    
    if (stepHistory.length > 0) {
      const prevStep = stepHistory[stepHistory.length - 1];
      setStepHistory((prev) => prev.slice(0, -1));
      setCurrentStep(prevStep);
    } else {
      voiceService.stopListening();
      setScreen('home');
    }
  };

  // Turkish speech normalizer
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s]/g, '');
  };

  // Word-matching algorithm
  const findMatchingOption = (spoken, optionsList, keyExtractor) => {
    const normSpoken = normalizeText(spoken);
    if (!normSpoken) return null;

    // First pass: exact normalized match
    for (const item of optionsList) {
      const name = keyExtractor(item);
      const normName = normalizeText(name);
      if (normSpoken === normName) {
        return item;
      }
    }

    // Second pass: inclusion match
    for (const item of optionsList) {
      const name = keyExtractor(item);
      const normName = normalizeText(name);
      if (normSpoken.includes(normName) || normName.includes(normSpoken)) {
        return item;
      }
    }

    return null;
  };

  // Parse slots from spoken indices or numbers
  const matchSlotByVoice = (spoken, slotList) => {
    const normSpoken = normalizeText(spoken);
    if (!normSpoken) return null;

    const indexWords = {
      'bir': 0, 'birinci': 0, '1': 0, 'tek': 0,
      'iki': 1, 'ikinci': 1, '2': 1,
      'uc': 2, 'ucuncu': 2, '3': 2,
      'dort': 3, 'dorduncu': 3, '4': 3,
      'bes': 4, 'besinci': 4, '5': 4,
    };

    // Check index words
    for (const word in indexWords) {
      if (normSpoken.includes(word)) {
        const index = indexWords[word];
        if (index < slotList.length) {
          return slotList[index];
        }
      }
    }

    // Check time matching (e.g. "saat on", "on otuz", "09:30")
    for (const slot of slotList) {
      const cleanTime = slot.time.replace(':', ''); // "1030"
      const timeSpeech = normalizeText(slot.time); // "10:30"
      if (normSpoken.includes(cleanTime) || normSpoken.includes(timeSpeech)) {
        return slot;
      }
    }

    return null;
  };

  // Main voice input state machine routing
  const handleVoiceInput = async (spoken) => {
    if (!spoken || spoken.trim() === '') {
      console.log("[Voice Assistant] Empty transcript, ignoring.");
      startVoiceRecognition();
      return;
    }

    if (voiceService.handleGlobalCommand(spoken, setScreen)) {
      return;
    }

    const norm = normalizeText(spoken);
    
    // Global controls
    if (norm.includes('geri') || norm.includes('geri don')) {
      handleGoBack();
      return;
    }
    if (norm.includes('ana sayfa') || norm.includes('iptal')) {
      voiceService.stopListening();
      setScreen('home');
      return;
    }

    // State machine matching steps
    switch (currentStep) {
      case 'intro':
        if (norm.includes('randevu al') || norm.includes('hastane randevusu') || norm.includes('randevu almak istiyorum')) {
          setLoading(true);
          try {
            const res = await apiClient.get('/locations/cities');
            setCities(res.data || []);
            navigateToStep('askCity');
          } catch (e) {
            console.error(e);
            speakAndListen('Şehir listesi yüklenemedi. Lütfen daha sonra tekrar deneyin.');
          } finally {
            setLoading(false);
          }
        } else if (norm.includes('aile hekimi')) {
          setLoading(true);
          try {
            const res = await apiClient.get('/family-physician/me');
            setFpInfo(res.data);
            if (res.data.has_family_physician) {
               const slotRes = await apiClient.get('/family-physician/slots');
              setSlots(slotRes.data || []);
              navigateToStep('askFpDate');
            } else {
              const msg = 'Kayıtlı aile hekiminiz bulunmamaktadır. Lütfen profil sayfasından aile hekimi atayın.';
              speakAndListen(msg);
              Alert.alert('Aile Hekimi Yok', msg, [
                { text: 'Tamam', onPress: () => setScreen('familyPhysician') }
              ]);
            }
          } catch (e) {
            console.error(e);
            speakAndListen('Aile hekimi bilgileri alınamadı.');
          } finally {
            setLoading(false);
          }
        } else if (norm.includes('randevularim') || norm.includes('randevularımı gor')) {
          voiceService.stopListening();
          setScreen('myAppointments');
        } else if (norm.includes('profil') || norm.includes('ayarlar')) {
          voiceService.stopListening();
          setScreen('profile');
        } else {
          speakAndListen('Sizi anlayamadım. Lütfen randevu al, aile hekimi veya randevularım seçeneklerinden birini söyleyin.');
        }
        break;

      case 'askCity':
        const matchedCity = findMatchingOption(spoken, cities, (c) => c.name);
        if (matchedCity) {
          setSelectedCity(matchedCity);
          setLoading(true);
          try {
            const res = await apiClient.get(`/locations/districts?city_id=${matchedCity.id}`);
            setDistricts(res.data || []);
            navigateToStep('askDistrict');
          } catch (e) {
            console.error(e);
            speakAndListen('İlçe listesi yüklenemedi.');
          } finally {
            setLoading(false);
          }
        } else {
          speakAndListen('Söylediğiniz şehir listede bulunamadı. Lütfen listedeki şehirlerden birini tekrar söyleyin.');
        }
        break;

      case 'askDistrict':
        const matchedDist = findMatchingOption(spoken, districts, (d) => d.name);
        if (matchedDist) {
          setSelectedDistrict(matchedDist);
          setLoading(true);
          try {
            const res = await apiClient.get('/branches');
            setBranches(res.data || []);
            navigateToStep('askDepartment');
          } catch (e) {
            console.error(e);
            speakAndListen('Branş listesi yüklenemedi.');
          } finally {
            setLoading(false);
          }
        } else {
          speakAndListen('Söylediğiniz ilçe bulunamadı. Lütfen listedeki ilçelerden birini söyleyin.');
        }
        break;

      case 'askDepartment':
        const matchedBranch = findMatchingOption(spoken, branches, (b) => b.name);
        if (matchedBranch) {
          setSelectedBranch(matchedBranch);
          setLoading(true);
          try {
            const res = await apiClient.get('/hospitals');
            setHospitals(res.data || []);
            navigateToStep('askHospital');
          } catch (e) {
            console.error(e);
            speakAndListen('Hastane listesi yüklenemedi.');
          } finally {
            setLoading(false);
          }
        } else {
          speakAndListen('Branş anlaşılamadı. Lütfen Kardiyoloji, Göz Hastalıkları gibi bir branş adı söyleyin.');
        }
        break;

      case 'askHospital':
        const matchedHosp = findMatchingOption(spoken, hospitals, (h) => h.name);
        if (matchedHosp) {
          setSelectedHospital(matchedHosp);
          setLoading(true);
          try {
            const res = await apiClient.get(`/doctors?hospital_id=${matchedHosp.id}&branch_id=${selectedBranch.id}`);
            setDoctors(res.data || []);
            navigateToStep('askDoctor');
          } catch (e) {
            console.error(e);
            speakAndListen('Doktor listesi yüklenemedi.');
          } finally {
            setLoading(false);
          }
        } else {
          speakAndListen('Hastane bulunamadı. Lütfen listeden uygun bir hastane adı söyleyin.');
        }
        break;

      case 'askDoctor':
        if (norm.includes('fark etmez') || norm.includes('doktor fark etmez') || norm.includes('herhangi biri')) {
          setSelectedDoctor(null);
          setLoading(true);
          try {
            const res = await apiClient.get(`/appointments/slots?hospital_id=${selectedHospital.id}&branch_id=${selectedBranch.id}`);
            setSlots(res.data || []);
            navigateToStep('askDate');
          } catch (e) {
            console.error(e);
            speakAndListen('Randevu saatleri alınamadı.');
          } finally {
            setLoading(false);
          }
        } else {
          const matchedDoc = findMatchingOption(spoken, doctors, (d) => d.full_name);
          if (matchedDoc) {
            setSelectedDoctor(matchedDoc);
            setLoading(true);
            try {
              const res = await apiClient.get(`/appointments/slots?hospital_id=${selectedHospital.id}&branch_id=${selectedBranch.id}&doctor_id=${matchedDoc.id}`);
              setSlots(res.data || []);
              navigateToStep('askDate');
            } catch (e) {
              console.error(e);
              speakAndListen('Hekime ait uygun randevu saatleri yüklenemedi.');
            } finally {
              setLoading(false);
            }
          } else {
            speakAndListen('Doktor ismi anlaşılamadı. Lütfen listeden bir doktor adı söyleyin veya "fark etmez" deyin.');
          }
        }
        break;

      case 'askDate':
        {
          const uniqueDates = getUniqueDates();
          const words = norm.split(' ');
          let matchedDate = null;
          
          // Index match
          const indexWords = { 'bir': 0, 'birinci': 0, 'iki': 1, 'ikinci': 1, 'uc': 2, 'ucuncu': 2, 'dort': 3, 'dorduncu': 3, 'bes': 4, 'besinci': 4 };
          for (const word of words) {
            if (indexWords[word] !== undefined && indexWords[word] < uniqueDates.length) {
              matchedDate = uniqueDates[indexWords[word]];
              break;
            }
          }
          if (matchedDate) {
            setSelectedDate(matchedDate);
            navigateToStep('askSlot');
          } else {
            speakAndListen('Tarih anlaşılamadı. Lütfen seçenek numaralarından birini söyleyin.');
          }
        }
        break;

      case 'askSlot': {
        const matchedSlot = matchSlotByVoice(spoken, getFilteredSlotsForSelectedDate());
        if (matchedSlot) {
          setSelectedSlot(matchedSlot);
          navigateToStep('confirm');
        } else {
          speakAndListen('Randevu saati anlaşılamadı. Lütfen seçenek numaralarından birini söyleyin.');
        }
        break;
      }

      case 'confirm':
        if (norm.includes('evet') || norm.includes('onayliyorum') || norm.includes('randevuyu al')) {
          handleConfirmBooking(false);
        } else if (norm.includes('hayir') || norm.includes('iptal')) {
          handleGoBack();
        } else {
          speakAndListen('Onay için sadece evet veya hayır demeniz yeterlidir. Onaylıyor musunuz?');
        }
        break;

      case 'askFpDate':
        {
          const uniqueDates = getUniqueDates();
          const words = norm.split(' ');
          let matchedDate = null;
          const indexWords = { 'bir': 0, 'birinci': 0, 'iki': 1, 'ikinci': 1, 'uc': 2, 'ucuncu': 2, 'dort': 3, 'dorduncu': 3, 'bes': 4, 'besinci': 4 };
          for (const word of words) {
            if (indexWords[word] !== undefined && indexWords[word] < uniqueDates.length) {
              matchedDate = uniqueDates[indexWords[word]];
              break;
            }
          }
          if (matchedDate) {
            setSelectedDate(matchedDate);
            navigateToStep('askFpSlot');
          } else {
            speakAndListen('Tarih anlaşılamadı. Lütfen seçenek numaralarından birini söyleyin.');
          }
        }
        break;

      case 'askFpSlot': {
        const matchedFpSlot = matchSlotByVoice(spoken, getFilteredSlotsForSelectedDate());
        if (matchedFpSlot) {
          setSelectedSlot(matchedFpSlot);
          navigateToStep('confirmFp');
        } else {
          speakAndListen('Saat anlaşılamadı. Lütfen listedeki seçeneklerden birini söyleyin.');
        }
        break;
      }

      case 'confirmFp':
        if (norm.includes('evet') || norm.includes('onayliyorum')) {
          handleConfirmBooking(true);
        } else if (norm.includes('hayir')) {
          handleGoBack();
        } else {
          speakAndListen('Lütfen evet veya hayır şeklinde cevap verin. Aile hekimi randevusunu onaylıyor musunuz?');
        }
        break;

      case 'success':
      case 'error':
        if (norm.includes('ana sayfa') || norm.includes('tamam')) {
          voiceService.stopListening();
          setScreen('home');
        } else if (norm.includes('randevularim')) {
          voiceService.stopListening();
          setScreen('myAppointments');
        } else {
          handleGoBack();
        }
        break;

      default:
        break;
    }
  };

  // Submit appointment booking to API
  const handleConfirmBooking = async (isFp = false) => {
    setLoading(true);
    try {
      const userDataStr = await AsyncStorage.getItem('user');
      const userObj = JSON.parse(userDataStr || '{}');

      const endpoint = isFp ? '/family-physician/book' : '/appointments/book';
      const payload = isFp
        ? {
            user_id: userObj.id || 1,
            family_physician_id: fpInfo.id,
            date: selectedSlot.date,
            time: selectedSlot.time,
            slot_id: selectedSlot.id,
          }
        : {
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
          };

      const res = await apiClient.post(endpoint, payload);

      if (res.data.success) {
        navigateToStep('success');
      } else {
        navigateToStep('error');
      }
    } catch (e) {
      console.error(e);
      navigateToStep('error');
    } finally {
      setLoading(false);
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
        if (monthIndex >= 0 && monthIndex < 12) {
          return `${day} ${months[monthIndex]}`;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return dateString;
  };

  // Simulation Fallback Option Buttons (Converts button tap to speech emulation)
  const renderSimulationOptions = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    let items = [];
    let keyExtractor = (item) => item.toString();
    let labelExtractor = (item) => item.toString();
    let onPressItem = (item) => {};

    switch (currentStep) {
      case 'intro':
        items = ['Randevu Al', 'Aile Hekimi', 'Randevularım', 'Profil ve Ayarlar', 'Ana Sayfaya Dön'];
        labelExtractor = (item) => item;
        onPressItem = (item) => handleVoiceInput(item);
        break;

      case 'askCity':
        items = cities;
        keyExtractor = (item) => item.id.toString();
        labelExtractor = (item) => item.name;
        onPressItem = (item) => handleVoiceInput(item.name);
        break;

      case 'askDistrict':
        items = districts;
        keyExtractor = (item) => item.id.toString();
        labelExtractor = (item) => item.name;
        onPressItem = (item) => handleVoiceInput(item.name);
        break;

      case 'askDepartment':
        items = branches;
        keyExtractor = (item) => item.id.toString();
        labelExtractor = (item) => item.name;
        onPressItem = (item) => handleVoiceInput(item.name);
        break;

      case 'askHospital':
        items = hospitals;
        keyExtractor = (item) => item.id.toString();
        labelExtractor = (item) => item.name;
        onPressItem = (item) => handleVoiceInput(item.name);
        break;

      case 'askDoctor':
        items = [{ id: 'any', full_name: 'Doktor Fark Etmez' }, ...doctors];
        keyExtractor = (item) => item.id.toString();
        labelExtractor = (item) => item.full_name;
        onPressItem = (item) => handleVoiceInput(item.id === 'any' ? 'fark etmez' : item.full_name);
        break;

      case 'askDate':
      case 'askFpDate':
        items = getUniqueDates();
        keyExtractor = (item) => item;
        labelExtractor = (item) => formatTurkishDateWithRelative(item);
        onPressItem = (item, index) => {
          handleVoiceInput(`${index + 1}. seçenek`);
        };
        break;

      case 'askSlot':
      case 'askFpSlot':
        items = getFilteredSlotsForSelectedDate();
        keyExtractor = (item) => item.id.toString();
        labelExtractor = (item) => {
          const isFp = currentStep === 'askFpSlot';
          return `Saat ${item.time} (${isFp ? 'Aile Hekimi' : item.doctor_name})`;
        };
        onPressItem = (item, index) => {
          handleVoiceInput(`${index + 1}. seçenek`);
        };
        break;

      case 'confirm':
      case 'confirmFp':
        items = ['Evet', 'Hayır'];
        labelExtractor = (item) => item;
        onPressItem = (item) => handleVoiceInput(item);
        break;

      case 'success':
        items = ['Randevularımı Gör', 'Ana Sayfaya Dön'];
        labelExtractor = (item) => item;
        onPressItem = (item) => {
          if (item === 'Randevularımı Gör') handleVoiceInput('randevularim');
          else handleVoiceInput('ana sayfa');
        };
        break;

      case 'error':
        items = ['Seçim Ekranına Geri Dön', 'Ana Sayfaya Dön'];
        labelExtractor = (item) => item;
        onPressItem = (item) => {
          if (item === 'Seçim Ekranına Geri Dön') handleVoiceInput('geri');
          else handleVoiceInput('ana sayfa');
        };
        break;

      default:
        break;
    }

    if (items.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={{ color: colors.muted, fontSize: fontSizes.medium }}>Müsait veri bulunamadı.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.choiceItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onPressItem(item, index)}
            accessibilityRole="button"
            accessibilityLabel={labelExtractor(item)}
            accessibilityHint="Seçmek ve sesli komut girmek için çift tıklayın"
          >
            <Text style={[styles.choiceItemText, { color: colors.text, fontSize: fontSizes.large }]}>
              {labelExtractor(item)}
            </Text>
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleGoBack}
            accessibilityRole="button"
            accessibilityLabel="Geri git"
            accessibilityHint="Bir önceki adıma veya ana sayfaya döner"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text, fontSize: fontSizes.large }]}>
              Geri
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text, fontSize: fontSizes.xlarge }]}>
            Sesli Asistan
          </Text>
        </View>

        {/* Pulse Visualizer graphic */}
        <View style={styles.visualizerContainer} accessible={false}>
          <Animated.View
            style={[
              styles.pulseCircle,
              {
                borderColor: isListening ? colors.primary : colors.border,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.pulseInner,
                {
                  backgroundColor: isListening
                    ? colors.primary
                    : isSpeaking
                    ? '#ff9800'
                    : colors.muted,
                },
              ]}
            >
              <MaterialIcons
                name={isListening ? 'mic' : isSpeaking ? 'volume-up' : 'mic-none'}
                size={36}
                color="#ffffff"
              />
            </View>
          </Animated.View>
          <Text style={[styles.statusText, { color: colors.text, fontSize: fontSizes.large, fontWeight: 'bold' }]}>
            Durum: {isListening
              ? 'Sizi dinliyorum...'
              : isSpeaking
              ? 'Asistan konuşuyor...'
              : recognitionMode === 'simulation'
              ? 'Ses tanıma kapalı (butonları kullanın)'
              : 'Asistan hazır'}
          </Text>
        </View>

        {/* Assistant voice transcript box */}
        <View style={[styles.transcriptBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.boxLabel, { color: colors.muted, fontSize: fontSizes.small }]}>
            ASİSTANIN SÖZÜ
          </Text>
          <Text style={[styles.transcriptText, { color: colors.text, fontSize: fontSizes.large }]}>
            {assistantText}
          </Text>
        </View>

        {/* User recognized text box */}
        <View style={[styles.transcriptBox, { backgroundColor: colors.card, borderLeftColor: colors.primary, borderLeftWidth: 4 }]}>
          <Text style={[styles.boxLabel, { color: colors.muted, fontSize: fontSizes.small }]}>
            ALGILANAN SESİNİZ
          </Text>
          <Text style={[styles.transcriptText, { color: colors.primary, fontSize: fontSizes.large, fontWeight: 'bold' }]}>
            {recognizedText || '(Ses bekleniyor...)'}
          </Text>
        </View>

        {/* Simulation option buttons */}
        <View style={{ flex: 1, marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: colors.text, fontSize: fontSizes.medium }]}>
            Seçenekler: (Sesli olarak söyleyebilir veya dokunabilirsiniz)
          </Text>
          {renderSimulationOptions()}
        </View>

        {/* Control row */}
        <View style={styles.controlRow}>
          <AccessibleButton
            title="Asistanı Tekrar Dinle"
            onPress={() => speakAndListen(assistantText)}
            accessibilityLabel="Asistanın açıklamasını tekrar dinle"
            style={{ backgroundColor: colors.primary, flex: 1 }}
          />
        </View>

        {/* Platform mode badge footer */}
        <View style={[styles.footer, { borderColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.muted, fontSize: fontSizes.small }]}>
            {recognitionMode === 'web'
              ? '🟢 Gerçek ses tanıma aktif — HTML5 Web Speech API kullanılıyor. Mikrofon izni tarayıcıdan isteniyor.'
              : recognitionMode === 'native'
              ? '🟢 Gerçek ses tanıma aktif — Android SpeechRecognizer (expo-speech-recognition). Tr-TR dili seçili.'
              : 'ℹ️ Ses tanıma kullanılamıyor (Expo Go veya native modül yüklenemedi). Profil > Ses Tanıma Debug ekranından durumu kontrol edin. Aşağıdaki seçenek kartlarına dokunarak devam edebilirsiniz.'}
          </Text>
        </View>
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
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
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
  title: {
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // offset back button
  },
  visualizerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    gap: 8,
  },
  pulseCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  pulseInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  statusText: {
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  transcriptBox: {
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 10,
  },
  boxLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontWeight: '500',
    lineHeight: 22,
  },
  choiceItem: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 10,
    elevation: 2,
    minHeight: 72,
    justifyContent: 'center',
  },
  choiceItemText: {
    fontWeight: '600',
  },
  sectionLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  footer: {
    borderTopWidth: 1.5,
    paddingTop: 10,
    paddingBottom: 16,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
  },
  centerContainer: {
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
