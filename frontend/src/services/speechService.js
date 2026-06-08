// src/services/speechService.js
// Speech Manager — Focus-first, no hover auto-read

const PRIORITY = {
  LOW:    1,   // reserved (hover disabled by default)
  NORMAL: 2,   // Page load, info
  HIGH:   3    // Focus, Click, Select change, R-key repeat
};

class SpeechManager {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.enabled   = false;
    this.rate      = 1.0;

    // State
    this.isSpeaking      = false;
    this.currentPriority = 0;
    this.lastSpokenText  = '';
    this.lastSpokenAt    = 0;

    // Timers
    this.pendingFocusTimer = null;
    this.pendingSpeakTimer = null;

    // Pre-load voices
    if (this.synthesis?.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = () => this._getVoice();
    }
  }

  setRate(rate) { this.rate = rate; }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.cancel(); // always cancel on toggle
  }

  _getVoice() {
    if (!this.synthesis) return null;
    const voices = this.synthesis.getVoices();
    return voices.find(v => v.lang.startsWith('tr')) || voices[0];
  }

  /**
   * Prefix short texts to prevent Chrome from clipping the first word.
   * Never prefixes texts longer than 10 words (they don't need it).
   */
  _addPrefix(text, type) {
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount > 10) return text;

    switch (type) {
      case 'input':
      case 'select':  return `Alan: ${text}`;
      case 'button':  return `Buton: ${text}`;
      case 'info':    return `Bilgi: ${text}`;
      default:        return text;
    }
  }

  /**
   * Core speak — with priority check and anti-spam.
   */
  speak(rawText, options = {}) {
    const { priority = PRIORITY.NORMAL, force = false, type = '' } = options;

    if (!this.synthesis)           return;
    if (!this.enabled && !force)   return;

    const text = (rawText || '').trim();
    if (!text) return;

    const now = Date.now();

    // Anti-spam: same text within 1.5 s → skip (unless forced or HIGH priority)
    if (
      !force &&
      priority < PRIORITY.HIGH &&
      this.lastSpokenText === text &&
      (now - this.lastSpokenAt) < 1500
    ) return;

    // Don't interrupt a higher-priority utterance with a lower one
    if (this.isSpeaking && this.currentPriority > priority) return;

    const finalText = this._addPrefix(text, type);

    this.currentPriority = priority;
    this.lastSpokenText  = text;
    this.lastSpokenAt    = now;

    this._clearFocusTimer();
    clearTimeout(this.pendingSpeakTimer);

    if (this.synthesis.speaking || this.synthesis.pending) {
      this.synthesis.cancel();
    }

    // 250 ms pause after cancel prevents Chrome first-word clipping
    this.pendingSpeakTimer = setTimeout(() => {
      if (!this.enabled && !force) return; // re-check after wait

      const utt   = new SpeechSynthesisUtterance(finalText);
      utt.lang    = 'tr-TR';
      utt.rate    = this.rate;

      const voice = this._getVoice();
      if (voice) utt.voice = voice;

      utt.onstart = ()  => { this.isSpeaking = true; };
      utt.onend   = ()  => { this.isSpeaking = false; this.currentPriority = 0; };
      utt.onerror = (e) => {
        if (e.error !== 'canceled') {
          this.isSpeaking = false;
          this.currentPriority = 0;
        }
      };

      // Prevent GC issues in some browsers
      window.__speechUtterance = utt;
      this.synthesis.speak(utt);
    }, 250);
  }

  /**
   * Called on element focus (TAB navigation).
   * Debounced 200 ms so rapid Tab presses don't spam synthesis.
   */
  speakOnFocus(text, type = '') {
    if (!this.enabled) return;
    this._clearFocusTimer();

    this.pendingFocusTimer = setTimeout(() => {
      if (!this.enabled) return;
      this.speak(text, { priority: PRIORITY.HIGH, type });
    }, 200);
  }

  /**
   * Repeat: re-read the currently focused element's speech text.
   * Called when user presses R key (only if enabled).
   */
  speakRepeat(text, type = '') {
    if (!this.enabled) return;
    // Force = false so it still respects disabled state,
    // but we bypass the anti-spam (same text re-read on demand).
    this._clearFocusTimer();
    clearTimeout(this.pendingSpeakTimer);
    if (this.synthesis.speaking || this.synthesis.pending) {
      this.synthesis.cancel();
    }
    // Short pause then speak with HIGH priority
    this.pendingSpeakTimer = setTimeout(() => {
      if (!this.enabled) return;
      const finalText = this._addPrefix((text || '').trim(), type);
      const utt = new SpeechSynthesisUtterance(finalText);
      utt.lang  = 'tr-TR';
      utt.rate  = this.rate;
      const voice = this._getVoice();
      if (voice) utt.voice = voice;
      utt.onstart = () => { this.isSpeaking = true; this.currentPriority = PRIORITY.HIGH; };
      utt.onend   = () => { this.isSpeaking = false; this.currentPriority = 0; };
      utt.onerror = () => { this.isSpeaking = false; this.currentPriority = 0; };
      window.__speechUtterance = utt;
      this.synthesis.speak(utt);
    }, 150);
  }

  /**
   * Hover speech.
   * Cancels previous and reads immediately.
   */
  speakOnHover(text, type = '') {
    if (!this.enabled) return;
    this._clearFocusTimer();
    this.speak(text, { priority: PRIORITY.HIGH, type });
  }

  speakOnSelectChange(label, selectedValue) {
    if (!this.enabled) return;
    this._clearFocusTimer();
    this.speak(
      `${label}: ${selectedValue} seçildi.`,
      { priority: PRIORITY.HIGH, type: 'info' }
    );
  }

  _clearFocusTimer() {
    if (this.pendingFocusTimer) {
      clearTimeout(this.pendingFocusTimer);
      this.pendingFocusTimer = null;
    }
  }

  // Legacy alias
  clearPendingHover() { this._clearFocusTimer(); }

  cancel() {
    this._clearFocusTimer();
    clearTimeout(this.pendingSpeakTimer);
    if (this.synthesis) this.synthesis.cancel();
    this.isSpeaking      = false;
    this.currentPriority = 0;
  }
}

export const speechService = new SpeechManager();

// Pre-load voices
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {};
}
