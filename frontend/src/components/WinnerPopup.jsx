import React, { useState, useEffect } from 'react';

const WinnerPopup = ({ winner, onClose }) => {
  const [countdown, setCountdown] = useState(6);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setShow(true);
    // Reset countdown on new winner
    setCountdown(6);
    
    // Countdown timer
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-lg"></div>
      
      {/* Confetti Overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center z-0">
        <div className="confetti-overlay"></div>
      </div>

      {/* Main Premium Trophy Card */}
      <div className={`relative z-10 bg-gradient-to-b from-[#09122C] via-[#0F172A] to-[#1E1B4B] text-white p-8 sm:p-10 rounded-[2.5rem] border border-yellow-500/30 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] flex flex-col items-center text-center max-w-md w-full transform transition-all duration-500 delay-100 ${show ? 'scale-100 translate-y-0' : 'scale-90 translate-y-10'}`}>
        
        {/* Background Sparkle Accents */}
        <div className="absolute top-4 left-6 w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
        <div className="absolute top-10 right-8 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
        <div className="absolute bottom-8 left-10 w-2 h-2 rounded-full bg-emerald-400"></div>
        <div className="absolute bottom-10 right-6 w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>

        {/* Golden 3D Trophy Graphic */}
        <div className="relative mb-4 mt-2">
          <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-2xl animate-pulse"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-600 flex items-center justify-center shadow-[0_0_40px_rgba(251,191,36,0.6)] border-4 border-yellow-200/50 relative z-10 animate-bounce-slow">
            <span className="text-5xl drop-shadow-md">🏆</span>
          </div>
        </div>

        {/* Prize Ribbon Banner */}
        <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-900/90 border border-yellow-500/40 px-6 py-2 rounded-full mb-3 shadow-lg flex items-center gap-2">
          <span className="text-yellow-300 font-black tracking-widest text-xs uppercase">
            🎉 {winner.prizeName} 🎉
          </span>
        </div>
        
        {/* Header Title */}
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md mb-2">
          Congratulations!
        </h1>

        {/* Subtitle / Verification */}
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-5">
          {winner.prizeItem ? `Prize: ${winner.prizeItem}` : 'Waiting for verification...'}
        </p>

        {/* Winner Name Box */}
        <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl mb-6 w-full backdrop-blur-sm flex flex-col items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Winner</span>
          <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-400">
            {displayName}
          </span>
        </div>

        {/* Branding Partner Badge */}
        <div className="mb-6 flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 px-4 py-1.5 rounded-full text-xs font-semibold text-emerald-300 shadow-inner">
          <span className="text-slate-400 text-[11px] font-medium">Branding Partner:</span>
          <span className="font-extrabold text-emerald-400 flex items-center gap-1">
            🌿 NutriDelight
          </span>
        </div>
        
        {/* Countdown */}
        <div className="flex flex-col items-center">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
            Next draw in...
          </span>
          <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center text-sm font-bold text-white bg-white/5 font-mono">
            {countdown}
          </div>
        </div>

      </div>
    </div>
  );
};

export default WinnerPopup;
