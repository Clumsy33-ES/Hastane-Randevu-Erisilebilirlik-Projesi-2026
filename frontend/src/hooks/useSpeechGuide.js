import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const shouldAutoEnableSpeech = (pathname) => {
  return pathname === '/login' || pathname === '/register';
};

export const useSpeechGuide = () => {
  const location = useLocation();
  const lastSpokenText = useRef('');
  const lastSpokenTime = useRef(0);

  const [userPreference, setUserPreference] = useState(() => {
    const saved = localStorage.getItem('audioGuidePreference');
    return saved !== null ? JSON.parse(saved) : null;
  });

  const isSpeechEnabled = useCallback((pathname) => {
    if (userPreference !== null) {
      return userPreference;
    }
    return shouldAutoEnableSpeech(pathname);
  }, [userPreference]);

  const toggleSpeech = () => {
    const nextVal = !isSpeechEnabled(location.pathname);
    setUserPreference(nextVal);
    localStorage.setItem('audioGuidePreference', JSON.stringify(nextVal));
    if (nextVal) {
      speakText('Sesli rehber açıldı. TAB tuşu ile alanlar arasında gezinebilirsiniz.', true);
    } else {
      stopSpeech();
    }
  };

  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = (text, force = false) => {
    if (!isSpeechEnabled(location.pathname)) return;
    
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim();
    if (!cleanText) return;

    const now = Date.now();
    // Anti-spam check
    if (!force && cleanText === lastSpokenText.current && now - lastSpokenTime.current < 1500) {
      return;
    }

    stopSpeech(); // cancel any ongoing speech

    lastSpokenText.current = cleanText;
    lastSpokenTime.current = now;

    // Small delay to prevent clipping in Chrome
    setTimeout(() => {
      // Re-check after timeout in case route changed or toggled
      if (!isSpeechEnabled(window.location.pathname)) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'tr-TR';
      
      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find(v => v.lang.startsWith('tr'));
      if (trVoice) {
        utterance.voice = trVoice;
      }
      
      // Prevent GC issues
      window.__speechUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const getReadableText = (element) => {
    if (!element) return "";
    
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
      return "";
    }

    if (element.getAttribute("aria-label")) return element.getAttribute("aria-label");
    if (element.dataset?.speech) return element.dataset.speech;
    if (element.getAttribute("title")) return element.getAttribute("title");

    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const placeholder = element.getAttribute("placeholder") || "";
      const val = element.value || "";
      const name = element.name || "";
      return placeholder || val || name || "";
    }

    return element.innerText?.trim() || element.textContent?.trim() || "";
  };

  // Route change cancellation
  useEffect(() => {
    stopSpeech();
    lastSpokenText.current = '';
    lastSpokenTime.current = 0;
  }, [location.pathname]);

  return {
    isSpeechEnabled: isSpeechEnabled(location.pathname),
    toggleSpeech,
    speakText,
    stopSpeech,
    getReadableText,
    shouldAutoEnableSpeech
  };
};
