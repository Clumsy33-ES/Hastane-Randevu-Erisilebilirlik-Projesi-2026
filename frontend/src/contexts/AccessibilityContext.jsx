import React, { createContext, useState, useEffect, useContext } from 'react';
import { useSpeechGuide } from '../hooks/useSpeechGuide';

const AccessibilityContext = createContext();

export function AccessibilityProvider({ children }) {
  const [isLargeText, setIsLargeText] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [announcement, setAnnouncement] = useState({ text: '', priority: 'polite' });
  
  const { 
    isSpeechEnabled, 
    toggleSpeech, 
    speakText, 
    getReadableText 
  } = useSpeechGuide();

  // ── Body class effects ──
  useEffect(() => {
    document.body.classList.toggle('large-text', isLargeText);
  }, [isLargeText]);

  useEffect(() => {
    document.body.classList.toggle('high-contrast', isHighContrast);
  }, [isHighContrast]);

  // ── Global focus & hover events ──
  useEffect(() => {
    if (!isSpeechEnabled) return;

    const getSpeakableElement = (target) => {
      if (!target || !target.closest) return null;
      return target.closest(
        'button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"], [tabindex="0"], [data-speech], .card, .apt-row'
      );
    };

    const handleFocusIn = (e) => {
      const el = getSpeakableElement(e.target);
      if (el) {
        speakText(getReadableText(el));
      }
    };

    const handleMouseOver = (e) => {
      const el = getSpeakableElement(e.target);
      if (el) {
        speakText(getReadableText(el));
      }
    };

    const handleChange = (e) => {
      if (e.target.tagName !== "SELECT") return;
      const selectedText = e.target.options[e.target.selectedIndex]?.text || "Seçim yapılmadı";
      speakText(`${e.target.getAttribute("aria-label") || "Seçim alanı"}: ${selectedText} seçildi.`);
    };

    const handleKeyUp = (e) => {
      if (e.target.tagName !== "SELECT") return;
      const keys = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp", "Enter", " "];
      if (keys.includes(e.key)) {
        setTimeout(() => {
          const selectedText = e.target.options[e.target.selectedIndex]?.text || "Seçim yapılmadı";
          speakText(`${e.target.getAttribute("aria-label") || "Seçim alanı"}: ${selectedText}`);
        }, 50);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const el = getSpeakableElement(document.activeElement);
        if (el) {
          speakText(getReadableText(el), true);
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('change', handleChange);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('change', handleChange);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSpeechEnabled, speakText, getReadableText]);

  // ── API ──
  const speak = (text, options = {}) => {
    // force=true is mapping to priority/force if needed, but we keep it simple here
    speakText(text, options.force);
  };

  const announce = (text, priority = 'polite') => {
    setAnnouncement({ text, priority });
    speak(text);
  };

  const toggleLargeText = () => setIsLargeText(v => !v);
  const toggleHighContrast = () => setIsHighContrast(v => !v);
  
  // Mapping for legacy usage
  const toggleAudioGuide = toggleSpeech;
  const isAudioGuide = isSpeechEnabled;

  return (
    <AccessibilityContext.Provider value={{
      isLargeText, toggleLargeText,
      isHighContrast, toggleHighContrast,
      isAudioGuide, toggleAudioGuide,
      speak, announce
    }}>
      {children}

      <div
        aria-live={announcement.priority}
        aria-atomic="true"
        style={{
          position: 'absolute', width: '1px', height: '1px',
          margin: '-1px', overflow: 'hidden',
          clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0
        }}
      >
        {announcement.text}
      </div>
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
