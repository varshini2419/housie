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

    // Countdown timer for 5s full-screen poster visibility
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
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-6 transition-all duration-500 select-none ${show ? 'opacity-100 backdrop-blur-2xl' : 'opacity-0 backdrop-blur-none pointer-events-none'}`}>
      
      {/* Full-Screen Dark Ambient Vignette Backdrop */}
      <div className="absolute inset-0 bg-slate-950/92"></div>

      {/* Radiant Radial Glow Beams */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-amber-500/25 via-emerald-500/30 to-purple-500/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>

      {/* Floating Animated Sparkles & Confetti Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-10 left-10 text-3xl animate-bounce delay-100">🎉</div>
        <div className="absolute top-16 right-12 text-3xl animate-bounce delay-300">✨</div>
        <div className="absolute bottom-16 left-12 text-3xl animate-bounce delay-200">🥳</div>
        <div className="absolute bottom-12 right-16 text-3xl animate-bounce delay-500">🏆</div>

        {/* Ambient Ping Dots */}
        <div className="absolute top-1/4 left-1/5 w-4 h-4 rounded-full bg-yellow-400 animate-ping"></div>
        <div className="absolute top-1/3 right-1/4 w-5 h-5 rounded-full bg-emerald-400 animate-ping delay-150"></div>
        <div className="absolute bottom-1/4 left-1/3 w-4 h-4 rounded-full bg-amber-400 animate-ping delay-300"></div>
        <div className="absolute bottom-1/3 right-1/5 w-4.5 h-4.5 rounded-full bg-purple-400 animate-ping delay-500"></div>
      </div>

      {/* MAIN FULL-SCREEN CHEERING POSTER CARD */}
      <div className={`relative z-10 bg-gradient-to-b from-slate-900/95 via-slate-900/98 to-slate-950 text-white p-6 sm:p-10 rounded-[2.5rem] border-2 border-amber-400/80 shadow-[0_0_90px_rgba(234,179,8,0.35)] flex flex-col items-center text-center max-w-lg w-full transform transition-all duration-500 ${show ? 'scale-100 translate-y-0' : 'scale-90 translate-y-12'}`}>

        {/* Top Gold Corner Badges */}
        <div className="absolute top-4 left-6 w-3 h-3 rounded-full bg-amber-400 animate-ping"></div>
        <div className="absolute top-4 right-6 w-3 h-3 rounded-full bg-emerald-400 animate-ping delay-200"></div>

        {/* PROMINENT SPONSOR BANNER: NutriDelight */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white px-5 py-2 rounded-full border border-emerald-300/50 shadow-lg shadow-emerald-950/60 flex items-center gap-2.5 mb-5 animate-bounce">
          <span className="text-lg">🌿</span>
          <span className="text-xs sm:text-sm font-black uppercase tracking-widest drop-shadow-sm">
            Sponsored by NutriDelight
          </span>
          <span className="text-lg">✨</span>
        </div>

        {/* GRAND 3D TROPHY ICON */}
        <div className="relative mb-3 mt-1">
          <div className="absolute inset-0 bg-amber-400/40 rounded-full blur-2xl animate-pulse"></div>
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 flex items-center justify-center shadow-2xl shadow-yellow-500/50 border-4 border-amber-200/90 relative z-10 animate-bounce">
            <span className="text-5xl sm:text-6xl drop-shadow-md">🏆</span>
          </div>
        </div>

        {/* CHEERING HEADER LABEL */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-black uppercase tracking-widest mb-3">
          <span>👏</span> WINNER CHEERS! <span>👏</span>
        </div>

        {/* TITLE */}
        <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 bg-clip-text text-transparent tracking-tight leading-tight mb-2 drop-shadow-sm">
          CONGRATULATIONS!
        </h1>

        {/* WINNER NAME */}
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl px-6 py-2.5 mb-4 w-full">
          <p className="text-xs text-amber-300 font-bold uppercase tracking-widest mb-0.5">CHAMPION</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight leading-tight drop-shadow-sm">
            {displayName}
          </p>
          <p className="text-xs text-slate-300 font-semibold mt-0.5">
            Ticket Code: <span className="font-mono text-amber-200 font-bold">#{winner.winnerTicket}</span>
          </p>
        </div>

        {/* PRIZE DETAILS BOX */}
        <div className="bg-slate-800/80 border border-slate-700/80 px-6 py-3.5 rounded-2xl mb-5 w-full flex flex-col items-center shadow-inner">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PRIZE WON</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 flex items-center gap-2">
            <span>🎁</span> {winner.prizeName}
          </span>
          {winner.prizeItem && (
            <span className="text-xs font-bold text-yellow-300 mt-1 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/30">
              Reward: {winner.prizeItem}
            </span>
          )}
        </div>

        {/* SPONSOR TAGLINE FOOTER */}
        <div className="text-[11px] font-medium text-emerald-300/90 mb-5 flex items-center justify-center gap-1.5 bg-emerald-950/50 px-4 py-1.5 rounded-full border border-emerald-800/60">
          <span>🍏</span> Powered by NutriDelight — Fresh, Healthy & Delicious!
        </div>

        {/* 5-SECOND COUNTDOWN RING */}
        <div className="flex flex-col items-center">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
            RESUMING GAME IN...
          </span>
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-3 border-amber-500/20 border-t-amber-400 animate-spin absolute"></div>
            <div className="w-12 h-12 rounded-full border border-amber-400/50 flex items-center justify-center text-base font-black text-amber-300 bg-slate-800 font-mono shadow-inner">
              {countdown}s
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WinnerPopup;

