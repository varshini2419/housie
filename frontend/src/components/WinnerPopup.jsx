import React, { useState, useEffect } from 'react';
import useSoundEffects from '../hooks/useSoundEffects';

const WinnerPopup = ({ winner, onClose }) => {
  const [countdown, setCountdown] = useState(5);
  const [show, setShow] = useState(false);
  const { playFanfare } = useSoundEffects();

  // Play triumphant victory fanfare chime
  useEffect(() => {
    playFanfare();
  }, [playFanfare]);

  useEffect(() => {
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
    <div className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4 transition-all duration-500 ${show ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-none pointer-events-none'}`}>
      
      {/* Dark Backdrop */}
      <div className="absolute inset-0 bg-black/80"></div>
      
      {/* Confetti & Sparkles Overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-3 h-3 rounded-full bg-yellow-400 animate-ping"></div>
        <div className="absolute top-1/3 right-1/4 w-4 h-4 rounded-full bg-emerald-400 animate-ping delay-150"></div>
        <div className="absolute bottom-1/4 left-1/3 w-3.5 h-3.5 rounded-full bg-blue-400 animate-ping delay-300"></div>
        <div className="absolute bottom-1/3 right-1/3 w-3 h-3 rounded-full bg-purple-400 animate-ping delay-500"></div>
        
        {/* Dynamic Confetti Particles */}
        <div className="confetti-overlay"></div>
      </div>

      {/* Main Glassmorphism Winner Card */}
      <div className={`relative z-10 bg-white/95 text-slate-800 p-8 sm:p-10 rounded-[2.5rem] border border-white shadow-[0_30px_90px_rgba(0,0,0,0.6)] flex flex-col items-center text-center max-w-sm sm:max-w-md w-full transform transition-all duration-500 delay-100 ${show ? 'scale-100 translate-y-0' : 'scale-90 translate-y-10'}`}>
        
        {/* Background Sparkle Accents */}
        <div className="absolute top-4 left-6 w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></div>
        <div className="absolute top-10 right-8 w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
        <div className="absolute bottom-8 left-10 w-2.5 h-2.5 rounded-full bg-blue-400"></div>
        <div className="absolute bottom-10 right-6 w-3 h-3 rounded-full bg-purple-400 animate-pulse"></div>

        {/* Golden 3D Trophy Icon */}
        <div className="relative mb-3 mt-1">
          <div className="absolute inset-0 bg-yellow-400/40 rounded-full blur-xl animate-pulse"></div>
          <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/40 border-4 border-white relative z-10 animate-bounce-slow">
            <span className="text-4xl sm:text-5xl drop-shadow-sm">🏆</span>
          </div>
        </div>

        {/* Header Label */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[11px] font-black uppercase tracking-widest mb-2">
          <span>🎉</span> WINNER ANNOUNCED!
        </div>
        
        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-tight mb-1">
          Congratulations!
        </h1>

        {/* Winner Name */}
        <p className="text-2xl sm:text-3xl font-black text-amber-500 tracking-tight leading-tight mb-4 drop-shadow-xs">
          {displayName}!
        </p>

        {/* Prize Ribbon Box */}
        <div className="bg-slate-100/90 border border-slate-200 px-6 py-3 rounded-2xl mb-4 w-full flex flex-col items-center shadow-inner">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">WON PRIZE</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-600 flex items-center gap-2">
            <span>🎁</span> {winner.prizeName}
          </span>
          {winner.prizeItem && (
            <span className="text-xs font-bold text-slate-600 mt-1">
              Reward: {winner.prizeItem}
            </span>
          )}
        </div>

        {/* Countdown Ring */}
        <div className="flex flex-col items-center mt-2">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
            RESUMING GAME IN...
          </span>
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-3 border-blue-500/20 border-t-blue-600 animate-spin absolute"></div>
            <div className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center text-base font-black text-slate-800 bg-slate-100 font-mono shadow-inner">
              {countdown}s
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WinnerPopup;
