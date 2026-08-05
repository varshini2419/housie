import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WinnerPopup = ({ winner, countdown, onClose, onBackToGame, instanceId = 0, isTimerLagging = false }) => {

  useEffect(() => {
    if (winner) {
      console.log('[POPUP] popup mounted', winner.prizeName, winner.winnerTicket, 'instance', instanceId);
      return () => {
        console.log('[POPUP] popup unmounted', winner.prizeName, winner.winnerTicket, 'instance', instanceId);
      };
    }
  }, [winner, instanceId]);

  const displayName = winner?.winnerName && winner.winnerName.trim() !== '' && winner.winnerName !== 'Player' 
    ? winner.winnerName 
    : `Ticket #${winner?.winnerTicket}`;

  // Unique key per popup instance so Framer Motion never reuses a stale lifecycle
  const popupKey = winner
    ? `winner-${instanceId}-${winner.prizeId}-${winner.winnerTicket}-${winner.prizeName}`
    : 'winner-none';

  return (
    <AnimatePresence mode="wait">
      {winner && (
        <motion.div 
          key={popupKey}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Deep Blur Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl"></div>
          
          {/* CSS Confetti / Sparkles background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center opacity-100 z-0">
             <div className="confetti-overlay"></div>
          </div>

          {/* Full-Screen Poster Canvas */}
          <motion.div 
            initial={{ scale: 0.8, y: 100, rotateX: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, rotateX: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -50, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 150 }}
            className="relative z-10 bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-3xl rounded-[3rem] border border-brand-border shadow-[0_40px_100px_rgba(0,0,0,0.3),_inset_0_2px_4px_rgba(255,255,255,1)] flex flex-col items-center text-center w-full max-w-2xl overflow-hidden"
          >
            {/* Top decorative banner */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-secondary/20 to-transparent"></div>

            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-3 rounded-full bg-black/5 hover:bg-black/10 transition-all duration-200 shadow-sm hover:shadow-md text-gray-500 hover:text-gray-800 z-50 focus:outline-none"
                aria-label="Close popup"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            <div className="p-8 sm:p-14 w-full flex flex-col items-center relative z-20">
              {/* Trophy Icon */}
              <motion.div 
                initial={{ scale: 0, rotate: -180, y: 50 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 150, delay: 0.2 }}
                className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-brand-warning to-brand-warning flex items-center justify-center shadow-[0_20px_50px_rgba(245,158,11,0.5)] border-4 border-white/90"
              >
                <span className="text-6xl drop-shadow-lg">🏆</span>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex flex-col items-center"
              >
                <h2 className="text-sm sm:text-base font-black text-brand-secondary uppercase tracking-[0.3em] mb-3">
                  🎉 Winner Announced 🎉
                </h2>
                <h1 className="text-5xl sm:text-7xl font-black text-brand-text mb-8 leading-tight tracking-tighter drop-shadow-sm">
                  {displayName}
                </h1>
              </motion.div>
              
              {/* Prize Details Section */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="w-full flex flex-col items-center gap-4 mb-10"
              >
                {/* Prize Category */}
                <div className="bg-brand-secondary/10 border border-brand-secondary/20 px-8 py-4 rounded-3xl w-full max-w-md shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-secondary/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
                  <p className="text-brand-secondary text-xs uppercase font-black tracking-widest mb-1">Won Category</p>
                  <p className="text-3xl sm:text-4xl font-extrabold text-brand-secondary truncate">
                    {winner?.prizeName}
                  </p>
                </div>

                {/* Prize Item & Sponsor row */}
                {(winner?.prizeItem || winner?.sponsor) && (
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    {winner?.prizeItem && (
                      <div className="bg-brand-warning/10 border border-brand-warning/20 px-6 py-4 rounded-3xl shadow-sm flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-20 h-20 bg-brand-warning/10 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>
                        <p className="text-brand-warning text-[10px] uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                          <span className="text-base">🎁</span> Prize
                        </p>
                        <p className="text-xl font-black text-brand-warning truncate w-full text-center">
                          {winner?.prizeItem}
                        </p>
                      </div>
                    )}
                    
                    {winner?.sponsor && (
                      <div className="bg-brand-primary/10 border border-brand-primary/20 px-6 py-4 rounded-3xl shadow-sm flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-brand-primary/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
                        <p className="text-brand-primary text-[10px] uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                          <span className="text-base">🤝</span> Sponsor
                        </p>
                        <p className="text-xl font-black text-brand-primary truncate w-full text-center">
                          {winner?.sponsor}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
              
              {/* Countdown / Status Line */}
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                className="flex items-center gap-4 bg-white/60 px-8 py-4 rounded-full border border-black/5 shadow-inner"
              >
                <div className={`w-3 h-3 rounded-full ${isTimerLagging ? 'bg-brand-warning' : 'bg-brand-secondary'} animate-pulse`}></div>
                <p className="text-brand-text-sec text-sm font-bold uppercase tracking-wider">
                  {isTimerLagging ? (
                    <span className="text-brand-warning">Synchronizing Game State...</span>
                  ) : (
                    <span>Game resuming in <span className="text-brand-secondary font-black text-xl tabular-nums ml-1">{countdown}</span>s</span>
                  )}
                </p>
              </motion.div>

              {/* Local dismiss only — does not resume the game or notify other players */}
              {(onBackToGame || onClose) && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
                  onClick={onBackToGame || onClose}
                  className="absolute bottom-6 text-brand-text-muted text-xs font-bold tracking-wide hover:text-brand-text-sec transition-colors focus:outline-none underline underline-offset-4"
                >
                  Dismiss
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WinnerPopup;
