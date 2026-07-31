import React, { useState, useEffect } from 'react';

const WinnerPopup = ({ winner, onClose }) => {
  const [countdown, setCountdown] = useState(10);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setShow(true);
    
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
  }, [onClose]);

  if (!winner) return null;

  const displayName = winner.winnerName && winner.winnerName.trim() !== '' && winner.winnerName !== 'Player' 
    ? winner.winnerName 
    : `Ticket #${winner.winnerTicket}`;

  return (
    <div className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4 transition-all duration-400 ${show ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Blurred Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
      
      {/* CSS Confetti / Sparkles background handled in index.css via classes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
         <div className="confetti-overlay"></div>
      </div>

      {/* Main Glassmorphism Card */}
      <div className={`relative z-10 glass-panel p-8 sm:p-12 rounded-[2rem] border border-white/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col items-center text-center max-w-lg w-full transform transition-all duration-500 delay-100 ${show ? 'scale-100 translate-y-0' : 'scale-90 translate-y-10'}`}>
        
        {/* Trophy Icon */}
        <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.5)] animate-bounce-slow border-4 border-white/30">
          <span className="text-5xl">🏆</span>
        </div>
        
        {/* Winner Name */}
        <h2 className="text-sm sm:text-base font-bold text-emerald-400 uppercase tracking-widest mb-2">
          Winner Announced!
        </h2>
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-lg mb-4 leading-tight">
          Congratulations<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">
            {displayName}!
          </span>
        </h1>
        
        {/* Prize Name */}
        <div className="bg-white/10 border border-white/20 px-6 py-3 rounded-2xl mb-8 backdrop-blur-sm">
          <p className="text-white/60 text-xs uppercase font-bold tracking-wider mb-1">Won Prize</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-300 drop-shadow-md">
            {winner.prizeName}
          </p>
        </div>
        
        {/* Countdown */}
        <div className="flex flex-col items-center">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
            Game resumes in
          </p>
          <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center text-xl font-bold text-white bg-white/5">
            {countdown}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default WinnerPopup;
