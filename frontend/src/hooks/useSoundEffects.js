import { useCallback } from 'react';

const useSoundEffects = () => {
  const getAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      return new AudioCtx();
    } catch (e) {
      return null;
    }
  };

  // Crisp POP sound when a number is drawn
  const playPop = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Satisfying stamp/mark click sound
  const playMark = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
      
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Prize claim chime sound
  const playClaim = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const playNote = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playNote(523.25, 0.0, 0.12); // C5
      playNote(659.25, 0.08, 0.12); // E5
      playNote(783.99, 0.16, 0.25); // G5
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Subtle clock tick sound for countdown
  const playTick = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.03);
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Triumphant 5-note brass victory fanfare
  const playFanfare = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const playFanfareNote = (freq, startTime, duration, type = 'triangle', maxGain = 0.35) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(maxGain, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      // 5-note ascending fanfare chime: C5, E5, G5, C6, G6
      playFanfareNote(523.25, 0.0, 0.2);   // C5
      playFanfareNote(659.25, 0.15, 0.2);  // E5
      playFanfareNote(783.99, 0.3, 0.25);  // G5
      playFanfareNote(1046.50, 0.5, 0.4);  // C6
      playFanfareNote(1567.98, 0.8, 1.2, 'sine', 0.4); // G6 triumph finale!
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  return {
    playPop,
    playMark,
    playClaim,
    playTick,
    playFanfare
  };
};

export default useSoundEffects;
