import { useState, useEffect, useCallback, useRef } from 'react';

const useSpeech = () => {
  const [isVoiceEnabledState, setIsVoiceEnabledState] = useState(() => {
    const saved = localStorage.getItem('voiceEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const isVoiceEnabled = useRef(isVoiceEnabledState);

  // Synchronize ref with state
  useEffect(() => {
    isVoiceEnabled.current = isVoiceEnabledState;
    localStorage.setItem('voiceEnabled', JSON.stringify(isVoiceEnabledState));
  }, [isVoiceEnabledState]);
  
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const speechQueue = useRef([]);
  const isSpeaking = useRef(false);
  const initialized = useRef(false);
  const currentSpokenNumber = useRef(null);
  const lastAnnouncedNumber = useRef(null);
  const timeoutRefs = useRef([]);
  const activeUtterances = useRef(new Set());

  // Initialize voices robustly
  useEffect(() => {
    const loadVoices = () => {
      if (!window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log('[Voice Engine] Loaded voices:', voices.length);
      }
    };
    
    if (window.speechSynthesis) {
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
    
    return () => {
       timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  // Unlock Chrome / Safari SpeechSynthesis audio on first user interaction
  const unlockAudio = useCallback(() => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.resume();
      if (!initialized.current) {
        console.log('[Voice Engine] Unlocking Audio context');
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
        initialized.current = true;
      }
    } catch (e) {
      console.warn('[Voice Engine] Audio unlock error:', e);
    }
  }, []);

  // Auto-unlock on window click or touch
  useEffect(() => {
    const handleInteraction = () => {
      unlockAudio();
    };
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [unlockAudio]);

  const toggleVoice = () => {
    unlockAudio();
    const next = !isVoiceEnabledState;
    setIsVoiceEnabledState(next);
    isVoiceEnabled.current = next;
    
    if (!next && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      speechQueue.current = [];
      isSpeaking.current = false;
      currentSpokenNumber.current = null;
      timeoutRefs.current.forEach(clearTimeout);
    }
  };

  const getBestVoice = () => {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    return voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Premium'))) 
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0];
  };

  const speakUtterance = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      console.log(`[VOICE ENGINE] Speaking text: "${text}"`);
      
      // Ensure Chrome speech engine is resumed
      try {
        window.speechSynthesis.resume();
      } catch (e) {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      const preferredVoice = getBestVoice();
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      let finished = false;
      let failsafeId = null;
      let resumeInterval = null;
      
      activeUtterances.current.add(utterance);
      
      const finish = () => {
        activeUtterances.current.delete(utterance);
        if (finished) return;
        finished = true;
        
        if (failsafeId) {
          clearTimeout(failsafeId);
          timeoutRefs.current = timeoutRefs.current.filter(id => id !== failsafeId);
        }

        if (resumeInterval) {
          clearInterval(resumeInterval);
        }
        
        resolve();
      };

      utterance.onstart = () => {
        console.log(`[VOICE ENGINE] Started: "${text}"`);
      };

      utterance.onend = () => {
        console.log(`[VOICE ENGINE] Ended: "${text}"`);
        finish();
      };
      
      utterance.onerror = (e) => {
        console.warn(`[VOICE ENGINE] Speech error for "${text}":`, e);
        finish();
      };

      // Periodic resume fix for Chrome SpeechSynthesis bug where long audio pauses
      resumeInterval = setInterval(() => {
        if (!finished && window.speechSynthesis && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 300);

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[VOICE ENGINE] Error executing speak():', err);
        finish();
      }
      
      // Failsafe timeout (4 seconds max per utterance)
      failsafeId = setTimeout(() => {
        if (!finished) {
          console.warn('[VOICE ENGINE] Utterance failsafe timeout triggered for:', text);
          try {
            window.speechSynthesis.resume();
          } catch (e) {}
          finish();
        }
      }, 4000);
      
      timeoutRefs.current.push(failsafeId);
    });
  };

  const processQueue = useCallback(async () => {
    if (!isVoiceEnabled.current || !window.speechSynthesis || speechQueue.current.length === 0) {
      isSpeaking.current = false;
      return;
    }

    if (isSpeaking.current) {
      return;
    }
    
    isSpeaking.current = true;
    const item = speechQueue.current.shift();
    
    if (typeof item === 'object' && item.type === 'winner') {
      try {
        await speakUtterance(item.text);
      } catch (err) {
        console.error('[VOICE ENGINE] Winner announcement error:', err);
      }
      isSpeaking.current = false;
      if (speechQueue.current.length > 0) processQueue();
      return;
    }

    const number = item;
    currentSpokenNumber.current = number;

    window.dispatchEvent(new CustomEvent('speech_started', { detail: { number } }));

    const digitWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

    try {
      const num = Number(number);
      if (num < 10) {
        // Single digit: "Single number 5, 5"
        await speakUtterance(`Single number ${num}, ${num}`);
      } else {
        // Two digits: "six five, sixty five"
        const digits = String(num).split('').map(d => digitWords[parseInt(d)]).join(' ');
        await speakUtterance(`${digits}, ${num}`);
      }
    } catch (err) {
      console.error('[VOICE ENGINE] Speech execution error:', err);
    }

    // Always dispatch speech_finished after speech completes
    window.dispatchEvent(new CustomEvent('speech_finished', { detail: { number } }));

    isSpeaking.current = false;
    currentSpokenNumber.current = null;
    
    if (speechQueue.current.length > 0) {
      processQueue();
    }
  }, []);

  const announceNumber = useCallback((number) => {
    if (!isVoiceEnabled.current || !window.speechSynthesis) {
      window.dispatchEvent(new CustomEvent('speech_finished', { detail: { number } }));
      return;
    }

    if (speechQueue.current.includes(number) || currentSpokenNumber.current === number) {
      window.dispatchEvent(new CustomEvent('speech_finished', { detail: { number } }));
      return;
    }
    
    lastAnnouncedNumber.current = number;
    speechQueue.current.push(number);
    
    if (!isSpeaking.current) {
      const id = setTimeout(() => {
        timeoutRefs.current = timeoutRefs.current.filter(ref => ref !== id);
        processQueue();
      }, 50);
      timeoutRefs.current.push(id);
    }
  }, [processQueue]);

  const announceWinner = useCallback((text) => {
    if (!isVoiceEnabled.current || !window.speechSynthesis) return;
    
    speechQueue.current.push({ type: 'winner', text });
    
    if (!isSpeaking.current) {
      const id = setTimeout(() => {
        timeoutRefs.current = timeoutRefs.current.filter(ref => ref !== id);
        processQueue();
      }, 50);
      timeoutRefs.current.push(id);
    }
  }, [processQueue]);

  return { 
    isVoiceEnabled: isVoiceEnabledState, 
    toggleVoice, 
    announceNumber, 
    speak: announceNumber,
    announceWinner, 
    unlockAudio 
  };
};

export default useSpeech;
