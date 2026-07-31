import { useState, useEffect, useCallback, useRef } from 'react';

const useSpeech = () => {
  const [isVoiceEnabledState, setIsVoiceEnabledState] = useState(() => {
    const saved = localStorage.getItem('voiceEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Use a ref so socket listeners never have a stale closure
  const isVoiceEnabled = useRef(isVoiceEnabledState);
  
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const speechQueue = useRef([]);
  const isSpeaking = useRef(false);
  const initialized = useRef(false);
  const currentSpokenNumber = useRef(null);
  const lastAnnouncedNumber = useRef(null); // CRITICAL: Global tracker to prevent duplicate announcements
  const timeoutRefs = useRef([]); // To track and clear failsafe timeouts
  const activeUtterances = useRef(new Set()); // CRITICAL: Prevent Garbage Collection of utterances

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
      window.speechSynthesis.cancel(); // Clear any zombie native queues from previous page loads
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
    
    return () => {
       // Cleanup timeouts on unmount
       timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  // Save preference
  useEffect(() => {
    localStorage.setItem('voiceEnabled', JSON.stringify(isVoiceEnabledState));
  }, [isVoiceEnabledState]);

  // Unlock iOS Safari SpeechSynthesis on first user interaction
  const unlockAudio = useCallback(() => {
    if (initialized.current || !window.speechSynthesis) return;
    console.log('[Voice Engine] Unlocking Audio context (iOS/Safari compat)');
    // Speak a space instead of empty string to avoid Safari lockups
    const utterance = new SpeechSynthesisUtterance(' '); 
    utterance.volume = 0; // Silent unlock
    window.speechSynthesis.speak(utterance);
    initialized.current = true;
  }, []);

  // Ensure unlock on toggle if not already unlocked
  const toggleVoice = () => {
    unlockAudio();
    const next = !isVoiceEnabled.current;
    isVoiceEnabled.current = next;
    setIsVoiceEnabledState(next);
    
    if (!next && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechQueue.current = [];
      isSpeaking.current = false;
      currentSpokenNumber.current = null;
      timeoutRefs.current.forEach(clearTimeout);
    }
  };

  const getBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Premium'))) 
      || voices.find(v => v.lang.startsWith('en-'));
  };

  const speakUtterance = (text) => {
    return new Promise((resolve) => {
      console.log(`[VOICE TRACE] Creating utterance for text: "${text}"`);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1;
      
      const preferredVoice = getBestVoice();
      if (preferredVoice) {
          utterance.voice = preferredVoice;
      }

      let finished = false;
      let failsafeId = null;
      
      activeUtterances.current.add(utterance); // Keep alive to prevent GC bug where onend never fires
      
      const finish = () => {
          activeUtterances.current.delete(utterance); // Release for GC
          if (finished) return;
          finished = true;
          
          if (failsafeId) {
              clearTimeout(failsafeId);
              timeoutRefs.current = timeoutRefs.current.filter(id => id !== failsafeId);
          }
          
          resolve();
      };

      utterance.onstart = () => {
          console.log(`[VOICE TRACE] onstart fired for text: "${text}"`);
      };

      utterance.onend = () => {
          console.log(`[VOICE TRACE] onend fired for text: "${text}"`);
          finish();
      };
      
      utterance.onerror = (e) => {
          console.error(`[VOICE TRACE] onerror fired for text: "${text}"`, e);
          finish();
      };

      window.speechSynthesis.speak(utterance);
      
      // Failsafe for stuck speech engine
      failsafeId = setTimeout(() => {
          if (!finished) {
              console.warn('[Voice Engine] Utterance failsafe triggered for text:', text);
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
              window.speechSynthesis.cancel();
              finish();
          }
      }, 5000);
      
      timeoutRefs.current.push(failsafeId);
    });
  };

  const processQueue = useCallback(async () => {
    if (!isVoiceEnabled.current || !window.speechSynthesis || speechQueue.current.length === 0) {
      isSpeaking.current = false;
      return;
    }

    if (isSpeaking.current) {
      return; // Prevent concurrent processing
    }
    
    isSpeaking.current = true;
    window.speechSynthesis.cancel(); // Ensure no zombie native queues
    
    const item = speechQueue.current.shift();
    
    if (typeof item === 'object' && item.type === 'winner') {
        try {
            await speakUtterance(item.text);
        } catch (err) {
            console.error('[Voice Engine] Winner announcement error:', err);
        }
        isSpeaking.current = false;
        if (speechQueue.current.length > 0) processQueue();
        return;
    }

    const number = item;
    currentSpokenNumber.current = number;

    window.dispatchEvent(new CustomEvent('speech_finished', { detail: { number } }));

    const digitWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

    try {
        const num = Number(number);
        if (num < 10) {
            // Single digit: "Single number 5, 5"
            await speakUtterance(`Single number ${num}, ${num}`);
        } else {
            // Two digits: "six five, sixty five" in a single smooth utterance
            const digits = String(num).split('').map(d => digitWords[parseInt(d)]).join(' ');
            await speakUtterance(`${digits}, ${num}`);
        }
    } catch (err) {
        console.error('[Voice Engine] Queue processing error:', err);
    }

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

    // STRICT GLOBAL DEDUPLICATION: Never announce the same number consecutively
    if (lastAnnouncedNumber.current === number) {
        return;
    }
    
    if (speechQueue.current.includes(number) || currentSpokenNumber.current === number) {
        return;
    }
    
    lastAnnouncedNumber.current = number; // Update global tracker
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
