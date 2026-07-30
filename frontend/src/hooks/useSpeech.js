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
    return voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Premium'))) 
      || voices.find(v => v.lang.startsWith('en-'));
  };

  const speakUtterance = (text) => {
    return new Promise((resolve) => {
      console.log(`[VOICE TRACE] Creating utterance for text: "${text}"`);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      const preferredVoice = getBestVoice();
      if (preferredVoice) {
          console.log(`[VOICE TRACE] Selected voice: ${preferredVoice.name}`);
          utterance.voice = preferredVoice;
      } else {
          console.log(`[VOICE TRACE] No preferred voice found, using default`);
      }

      let finished = false;
      
      activeUtterances.current.add(utterance); // Keep alive to prevent GC bug where onend never fires
      
      const finish = () => {
          activeUtterances.current.delete(utterance); // Release for GC
          if (finished) return;
          finished = true;
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

      console.log(`[VOICE TRACE] Calling window.speechSynthesis.speak() for text: "${text}"`);
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
    console.log(`[VOICE TRACE] processQueue started`);
    if (!isVoiceEnabled.current || !window.speechSynthesis || speechQueue.current.length === 0) {
      console.log(`[VOICE TRACE] processQueue returned early. enabled: ${isVoiceEnabled.current}, queue: ${speechQueue.current.length}`);
      isSpeaking.current = false;
      return;
    }

    if (isSpeaking.current) {
      console.log(`[VOICE TRACE] processQueue blocked by isSpeaking.current = true`);
      return; // Prevent concurrent processing
    }
    
    isSpeaking.current = true;
    
    // Removed the aggressive `window.speechSynthesis.cancel()` here that was swallowing utterances
    
    const number = speechQueue.current.shift();
    currentSpokenNumber.current = number;
    
    console.log(`[VOICE TRACE] Number shifted from queue: ${number}`);

    try {
        if (number < 10) {
            // Single digit: Speak once
            await speakUtterance(String(number));
        } else {
            // Two digits: "Two Four" -> Pause 500ms -> "Twenty Four"
            const digits = String(number).split('').join(' ');
            await speakUtterance(digits);
            
            if (isVoiceEnabled.current) {
                await delay(500); // Strict 500ms programmatic pause
                if (isVoiceEnabled.current) {
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
  }, []);

  const announceNumber = useCallback((number) => {
    console.log(`[VOICE TRACE] announceNumber called for: ${number}`);
    if (!isVoiceEnabled.current || !window.speechSynthesis) {
        console.log(`[VOICE TRACE] announceNumber skipped. Enabled: ${isVoiceEnabled.current}`);
        return;
    }
    
    // STRICT Deduplication: Prevent multiple identical queue entries or re-queuing the currently speaking number
    if (speechQueue.current.includes(number) || currentSpokenNumber.current === number) {
        console.log(`[VOICE TRACE] Skipped duplicate number: ${number}`);
        return;
    }
    
    console.log(`[VOICE TRACE] Queued number: ${number}`);
    speechQueue.current.push(number);
    
    if (!isSpeaking.current) {
      console.log(`[VOICE TRACE] Scheduling processQueue (queue length: ${speechQueue.current.length})`);
      // In JS event loop, multiple sync calls to announceNumber will queue numbers first.
      // setTimeout ensures processQueue checks the fully populated queue on the next tick.
      const id = setTimeout(processQueue, 50);
      timeoutRefs.current.push(id);
    }
  }, [processQueue]);

  return { isVoiceEnabled: isVoiceEnabledState, toggleVoice, announceNumber, unlockAudio };
};

export default useSpeech;
