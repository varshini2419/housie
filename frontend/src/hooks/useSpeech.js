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
  const currentSpokenNumber = useRef(null);
  const timeoutRefs = useRef([]); // To track and clear failsafe timeouts

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
    
    return () => {
       // Cleanup timeouts on unmount
       timeoutRefs.current.forEach(clearTimeout);
    };
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
        currentSpokenNumber.current = null;
        timeoutRefs.current.forEach(clearTimeout);
      }
      return next;
    });
  };

  const getBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Premium'))) 
      || voices.find(v => v.lang.startsWith('en-'));
  };

  const speakUtterance = (text) => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      const preferredVoice = getBestVoice();
      if (preferredVoice) utterance.voice = preferredVoice;

      let finished = false;
      
      const finish = () => {
          if (finished) return;
          finished = true;
          resolve();
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
          console.error('[Voice Engine] Utterance error:', e);
          finish();
      };

      window.speechSynthesis.speak(utterance);
      
      // Failsafe for Safari where onend might not fire
      const failsafe = setTimeout(() => {
          if (!finished) {
              console.warn('[Voice Engine] Utterance failsafe triggered for text:', text);
              window.speechSynthesis.cancel();
              finish();
          }
      }, 5000);
      
      timeoutRefs.current.push(failsafe);
    });
  };

  const delay = (ms) => {
      return new Promise(resolve => {
          const id = setTimeout(resolve, ms);
          timeoutRefs.current.push(id);
      });
  };

  const processQueue = useCallback(async () => {
    if (!isVoiceEnabled || !window.speechSynthesis || speechQueue.current.length === 0) {
      isSpeaking.current = false;
      return;
    }

    if (isSpeaking.current) return; // Prevent concurrent processing
    
    isSpeaking.current = true;
    
    // Clear any native ghost queues just to be strictly safe
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
    }
    
    const number = speechQueue.current.shift();
    currentSpokenNumber.current = number;
    
    console.log(`[Voice Engine] Processing number: ${number}`);

    try {
        if (number < 10) {
            // Single digit: Speak once
            await speakUtterance(String(number));
        } else {
            // Two digits: "Two Four" -> Pause 500ms -> "Twenty Four"
            const digits = String(number).split('').join(' ');
            await speakUtterance(digits);
            
            if (isVoiceEnabled) {
                await delay(500); // Strict 500ms programmatic pause
                if (isVoiceEnabled) {
                    await speakUtterance(String(number));
                }
            }
        }
    } catch (err) {
        console.error('[Voice Engine] Queue processing error:', err);
    }

    // Small natural delay before processing the next number in queue
    await delay(300);
    
    isSpeaking.current = false;
    currentSpokenNumber.current = null;
    
    // Check if more items exist
    if (speechQueue.current.length > 0) {
        processQueue();
    }
  }, [isVoiceEnabled]);

  const announceNumber = useCallback((number) => {
    if (!isVoiceEnabled || !window.speechSynthesis) {
        return;
    }
    
    // STRICT Deduplication: Prevent multiple identical queue entries or re-queuing the currently speaking number
    if (speechQueue.current.includes(number) || currentSpokenNumber.current === number) {
        console.log(`[Voice Engine] Skipped duplicate number: ${number}`);
        return;
    }
    
    console.log(`[Voice Engine] Queued number: ${number}`);
    speechQueue.current.push(number);
    
    if (!isSpeaking.current) {
      // In JS event loop, multiple sync calls to announceNumber will queue numbers first.
      // setTimeout ensures processQueue checks the fully populated queue on the next tick.
      const id = setTimeout(processQueue, 50);
      timeoutRefs.current.push(id);
    }
  }, [isVoiceEnabled, processQueue]);

  return { isVoiceEnabled, toggleVoice, announceNumber, unlockAudio };
};

export default useSpeech;
