import React, { useState, useEffect } from 'react';

const WinnerPopup = ({ winner, onClose }) => {
  const [countdown, setCountdown] = useState(5);
  const [show, setShow] = useState(false);

  // Synthesize triumphant cheering/victory fanfare sound effect using Web Audio API
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playFanfareNote = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(0.35, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      // Play 4-note ascending fanfare chime: C5, E5, G5, C6
      playFanfareNote(523.25, 0.0, 0.25); // C5
      playFanfareNote(659.25, 0.2, 0.25); // E5
      playFanfareNote(783.99, 0.4, 0.35); // G5
      playFanfareNote(1046.50, 0.65, 0.9); // C6 (triumph finale note!)
    } catch (e) {
      console.log('Audio playback error:', e);
    }
  }, []);

  useEffect(() => {
    // Trigger entrance animation
    setShow(true);
    setCountdown(5);
    
    // Countdown timer for 5s popup visibility
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShow(false);
          setTimeout(onClose, 400); // Wait for exit animation
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [winner, onClose]);

  if (!winner) return null;

  const displayName = winner.winnerName && winner.winnerName.trim() !== '' && winner.winnerName !== 'Player' 
    ? winner.winnerName 
    : `Ticket #${winner.winnerTicket}`;

  return (
    <div className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4 transition-all duration-400 ${show ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Dark Blurred Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
      
      {/* Confetti Overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center z-0">
        <div className="confetti-overlay"></div>
      </div>

      {/* Main Glassmorphism Winner Card (Matching Sample UI) */}
      <div className={`relative z-10 bg-white/95 text-slate-800 p-8 sm:p-10 rounded-[2.5rem] border border-white/80 shadow-[0_30px_90px_rgba(0,0,0,0.6)] flex flex-col items-center text-center max-w-sm sm:max-w-md w-full transform transition-all duration-500 delay-100 ${show ? 'scale-100 translate-y-0' : 'scale-90 translate-y-10'}`}>
        
        {/* Background Sparkle Accents */}
        <div className="absolute top-4 left-6 w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></div>
        <div className="absolute top-10 right-8 w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
        <div className="absolute bottom-8 left-10 w-2.5 h-2.5 rounded-full bg-blue-400"></div>
        <div className="absolute bottom-10 right-6 w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse"></div>

        {/* Golden 3D Trophy Icon */}
        <div className="relative mb-3 mt-1">
          <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-xl animate-pulse"></div>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/40 border-4 border-white relative z-10 animate-bounce-slow">
            <span className="text-4xl drop-shadow-sm">🏆</span>
          </div>
        </div>

        {/* Header Label */}
        <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">
          WINNER ANNOUNCED!
        </h2>
        
        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-tight mb-1">
          Congratulations!
        </h1>

        {/* Winner Name in Yellow/Amber Gradient */}
        <p className="text-2xl sm:text-3xl font-black text-amber-500 tracking-tight leading-tight mb-4 drop-shadow-xs">
          {displayName}!
        </p>

        {/* Prize Ribbon Box */}
        <div className="bg-slate-100/90 border border-slate-200/80 px-6 py-2.5 rounded-2xl mb-4 w-full flex flex-col items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">WON PRIZE</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-600">
            {winner.prizeName}
          </span>
        </div>

        {/* Branding Partner Badge */}
        <div className="mb-5 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-4 py-1.5 rounded-full text-xs font-bold text-emerald-700 shadow-xs">
          <span className="text-slate-400 text-[11px] font-medium">Branding Partner:</span>
          <span className="font-extrabold text-emerald-700 flex items-center gap-1">
            🌿 NutriDelight
          </span>
        </div>
        
        {/* Countdown Timer Circle */}
        <div className="flex flex-col items-center">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
            NEXT NUMBER IN...
          </span>
          <div className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-black text-slate-700 bg-slate-100 font-mono shadow-inner">
            {countdown}
          </div>
        </div>

      </div>
    </div>
  );
};

export default WinnerPopup;
