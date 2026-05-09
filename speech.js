// =====================================================
// SPEECH.JS - Web Speech API wrapper
// English (British accent) + Czech pronunciation
// =====================================================

const SpeechManager = {
  voices: [],
  preferredVoiceEn: null,
  preferredVoiceCz: null,
  rate: 0.85,
  ready: false,

  init() {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser');
      return;
    }

    const loadVoices = () => {
      this.voices = speechSynthesis.getVoices();

      // English voice priority
      this.preferredVoiceEn =
        this.voices.find(v => v.name === 'Google UK English Female') ||
        this.voices.find(v => v.name.includes('Samantha')) ||
        this.voices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('female')) ||
        this.voices.find(v => v.lang === 'en-GB') ||
        this.voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        this.voices.find(v => v.lang.startsWith('en'));

      // Czech voice priority
      this.preferredVoiceCz =
        this.voices.find(v => v.lang === 'cs-CZ') ||
        this.voices.find(v => v.lang.startsWith('cs'));

      if (this.preferredVoiceEn) {
        this.ready = true;
      }
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    setTimeout(loadVoices, 500);
  },

  speak(text) {
    this._speak(text, 'en');
  },

  speakCzech(text) {
    this._speak(text, 'cz');
  },

  _speak(text, lang) {
    if (!('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    if (lang === 'cz') {
      utterance.lang = 'cs-CZ';
      if (this.preferredVoiceCz) {
        utterance.voice = this.preferredVoiceCz;
      }
    } else {
      utterance.lang = 'en-GB';
      if (this.preferredVoiceEn) {
        utterance.voice = this.preferredVoiceEn;
      }
    }

    utterance.rate = this.rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    speechSynthesis.speak(utterance);
  },

  // Speak two words in sequence: first one language, then the other
  speakBoth(textFirst, langFirst, textSecond, langSecond) {
    if (!('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const u1 = new SpeechSynthesisUtterance(textFirst);
    u1.lang = langFirst === 'cz' ? 'cs-CZ' : 'en-GB';
    if (langFirst === 'cz' && this.preferredVoiceCz) u1.voice = this.preferredVoiceCz;
    if (langFirst === 'en' && this.preferredVoiceEn) u1.voice = this.preferredVoiceEn;
    u1.rate = this.rate;

    const u2 = new SpeechSynthesisUtterance(textSecond);
    u2.lang = langSecond === 'cz' ? 'cs-CZ' : 'en-GB';
    if (langSecond === 'cz' && this.preferredVoiceCz) u2.voice = this.preferredVoiceCz;
    if (langSecond === 'en' && this.preferredVoiceEn) u2.voice = this.preferredVoiceEn;
    u2.rate = this.rate;

    speechSynthesis.speak(u1);
    speechSynthesis.speak(u2);
  },

  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2, rate));
  }
};
