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
    if (!isVoiceEnabled || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Cancel any ongoing speech

    let textToSpeak = '';
    if (number < 10) {
      textToSpeak = String(number);
    } else {
      const digits = String(number).split('').join(' ');
      // The browser's TTS will naturally pause on ellipses or commas
      textToSpeak = `${digits}... ${number}`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    
    // Attempt to pick a good English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google')) 
      || voices.find(v => v.lang.startsWith('en-'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [isVoiceEnabled]);

  return { isVoiceEnabled, toggleVoice, announceNumber };
};

export default useSpeech;
