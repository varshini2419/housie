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

  // Unlock iOS/Safari/Chrome SpeechSynthesis on user interaction
  const unlockAudio = useCallback(() => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.resume();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (!initialized.current) {
        console.log('[Voice Engine] Unlocking Audio context');
        window.speechSynthesis.cancel();
        initialized.current = true;
      }
    } catch (e) {
      console.warn('[Voice Engine] Audio unlock error:', e);
    }
  }, []);

  // Initialize and load voices robustly
  useEffect(() => {
    const loadVoices = () => {
      if (!window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log('[Voice Engine] Loaded voices:', voices.length);
      }
    };
    
    const handleFirstInteraction = () => {
      console.log('[Voice Engine] First user interaction detected, unlocking audio');
      unlockAudio();
    };
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      window.addEventListener('pointerdown', handleFirstInteraction, { once: true, passive: true });
      window.addEventListener('keydown', handleFirstInteraction, { once: true, passive: true });
    }
    
    return () => {
       timeoutRefs.current.forEach(clearTimeout);
       window.removeEventListener('pointerdown', handleFirstInteraction);
       window.removeEventListener('keydown', handleFirstInteraction);
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

    const enVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    const candidateVoices = enVoices.length > 0 ? enVoices : voices;

    const localVoice = candidateVoices.find(v => v.localService && (
      v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Premium')
    ));
    if (localVoice) return localVoice;

    const anyLocal = candidateVoices.find(v => v.localService);
    if (anyLocal) return anyLocal;

    const preferred = candidateVoices.find(v => (
      v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Premium')
    ));
    if (preferred) return preferred;

    return candidateVoices[0];
  };

  const speakUtterance = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      console.log(`[VOICE ENGINE] Speaking text: "${text}"`);
      
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
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

      resumeInterval = setInterval(() => {
        if (!finished && window.speechSynthesis) {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }
      }, 200);

      try {
        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.error('[VOICE ENGINE] Error executing speak():', err);
        finish();
      }
      
      failsafeId = setTimeout(() => {
        if (!finished) {
          console.warn('[VOICE ENGINE] Utterance failsafe timeout triggered for:', text);
          finish();
        }
      }, 3000);
      
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
    
    let number = null;
    if (typeof item === 'object' && item.type === 'winner') {
      try {
        await speakUtterance(item.text);
      } catch (err) {
        console.error('[VOICE ENGINE] Winner announcement error:', err);
      } finally {
        isSpeaking.current = false;
        if (speechQueue.current.length > 0) processQueue();
      }
      return;
    }

    number = item;
    currentSpokenNumber.current = number;

    window.dispatchEvent(new CustomEvent('speech_started', { detail: { number } }));

    const digitWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

    try {
      const num = Number(number);
      if (!isNaN(num)) {
        if (num < 10) {
          await speakUtterance(`Single number ${num}, ${num}`);
        } else {
          const digits = String(num).split('').map(d => digitWords[parseInt(d)]).join(' ');
          await speakUtterance(`${digits}, ${num}`);
        }
      }
    } catch (err) {
      console.error('[VOICE ENGINE] Speech execution error:', err);
    } finally {
      window.dispatchEvent(new CustomEvent('speech_finished', { detail: { number } }));
      isSpeaking.current = false;
      currentSpokenNumber.current = null;
      
      if (speechQueue.current.length > 0) {
        processQueue();
      }
    }
  }, []);

  const announceNumber = useCallback((number) => {
    window.dispatchEvent(new CustomEvent('speech_finished', { detail: { number } }));

    if (!isVoiceEnabled.current || !window.speechSynthesis) {
      return;
    }

    const numStr = String(number);
    if (speechQueue.current.some(item => String(item) === numStr) || String(currentSpokenNumber.current) === numStr) {
      return;
    }
    
    lastAnnouncedNumber.current = number;
    speechQueue.current.push(number);
    
    if (!isSpeaking.current) {
      processQueue();
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
