import { useState, useEffect, useCallback, useRef } from 'react';

const useSpeech = () => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('voiceEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const speechQueue = useRef([]);
  const isSpeaking = useRef(false);
  const initialized = useRef(false);

  // Initialize and load voices robustly (especially for Safari/iOS)
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log('[Voice Engine] Voices loaded successfully', voices.length);
      }
    };
    
    if (window.speechSynthesis) {
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Save preference
  useEffect(() => {
    localStorage.setItem('voiceEnabled', JSON.stringify(isVoiceEnabled));
  }, [isVoiceEnabled]);

  // Unlock iOS Safari SpeechSynthesis on first user interaction
  const unlockAudio = useCallback(() => {
    if (initialized.current || !window.speechSynthesis) return;
    console.log('[Voice Engine] Unlocking Audio context (iOS/Safari compat)');
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0; // Silent unlock
    window.speechSynthesis.speak(utterance);
    initialized.current = true;
  }, []);

  // Ensure unlock on toggle if not already unlocked
  const toggleVoice = () => {
    unlockAudio();
    setIsVoiceEnabled(prev => {
      const next = !prev;
      if (!next && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        speechQueue.current = [];
        isSpeaking.current = false;
      }
      return next;
    });
  };

  const processQueue = useCallback(() => {
    if (!isVoiceEnabled || !window.speechSynthesis || speechQueue.current.length === 0) {
      isSpeaking.current = false;
      return;
    }

    if (window.speechSynthesis.speaking) {
      return; // Wait for current speech to finish
    }

    isSpeaking.current = true;
    const number = speechQueue.current.shift();
    
    let textToSpeak = '';
    if (number < 10) {
      textToSpeak = String(number);
    } else {
      const digits = String(number).split('').join(' ');
      textToSpeak = `${digits}, ${number}`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Attempt to pick a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Premium'))) 
      || voices.find(v => v.lang.startsWith('en-'));
      
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      console.log(`[Voice Engine] Finished speaking ${number}`);
      // Process next item in queue with slight delay for natural pacing
      setTimeout(processQueue, 300);
    };

    utterance.onerror = (e) => {
      console.error('[Voice Engine] Speech synthesis error:', e);
      // Attempt recovery by processing next in queue anyway
      setTimeout(processQueue, 500);
    };

    console.log(`[Voice Engine] Speaking: ${textToSpeak}`);
    window.speechSynthesis.speak(utterance);
    
    // Failsafe: if browser gets stuck in speaking state without emitting onend
    setTimeout(() => {
        if(isSpeaking.current && window.speechSynthesis.speaking) {
           console.warn('[Voice Engine] Failsafe: Speech got stuck. Resetting queue engine.');
           window.speechSynthesis.cancel();
           processQueue();
        }
    }, 6000);
  }, [isVoiceEnabled]);

  const announceNumber = useCallback((number) => {
    if (!isVoiceEnabled || !window.speechSynthesis) {
        console.log(`[Voice Engine] Skipped announcing ${number} (Engine disabled)`);
        return;
    }
    
    console.log(`[Voice Engine] Queued number: ${number}`);
    speechQueue.current.push(number);
    
    if (!isSpeaking.current) {
      processQueue();
    }
  }, [isVoiceEnabled, processQueue]);

  return { isVoiceEnabled, toggleVoice, announceNumber, unlockAudio };
};

export default useSpeech;
