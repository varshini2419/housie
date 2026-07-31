import { useState, useEffect, useCallback } from 'react';

const useSpeech = () => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('voiceEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('voiceEnabled', JSON.stringify(isVoiceEnabled));
  }, [isVoiceEnabled]);

  const toggleVoice = () => {
    setIsVoiceEnabled(prev => {
      const next = !prev;
      if (!next && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const announceNumber = useCallback((number) => {
    if (!window.speechSynthesis || number === null || number === undefined) return;

    // Cancel any ongoing speech immediately to prevent speech backlog/queuing
    window.speechSynthesis.cancel();

    let textToSpeak = '';
    const num = Number(number);
    if (num < 10) {
      textToSpeak = `Single number ${num}, ${num}`;
    } else {
      // Split digits for "6 5" ("six five") followed by full number "65" ("sixty five")
      const digits = String(num).split('').join(' ');
      textToSpeak = `${digits}, ${num}`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = 
      voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))) ||
      voices.find(v => v.lang.startsWith('en-'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    setTimeout(() => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    }, 40);
  }, []);

  return { 
    isVoiceEnabled, 
    toggleVoice, 
    announceNumber,
    speak: announceNumber
  };
};

export default useSpeech;
