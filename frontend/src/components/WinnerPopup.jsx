import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WinnerPopup = ({ winner, countdown = 5, onClose, onBackToGame, instanceId = 0, isTimerLagging = false }) => {

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

  const popupKey = winner
    ? `winner-${instanceId}-${winner.prizeId || winner.prizeName}-${winner.winnerTicket}`
    : 'winner-none';

  return (
    <AnimatePresence mode="wait">
      {winner && (
        <motion.div 
          key={popupKey}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4 overflow-hidden select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Deep Blur Backdrop */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl"></div>
          
          {/* Ambient Radial Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-amber-500/20 via-indigo-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse pointer-events-none" />

          {/* Full-Screen Poster Canvas */}
          <motion.div 
            initial={{ scale: 0.85, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -30, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 200 }}
            className="relative z-10 bg-slate-900/95 border border-slate-800 text-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_25px_80px_rgba(0,0,0,0.5)] flex flex-col items-center text-center max-w-lg w-full overflow-hidden"
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-400 to-indigo-500" />

            {/* Close Button */}
            {(onClose || onBackToGame) && (
              <button
                onClick={onBackToGame || onClose}
                className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-50 focus:outline-none"
                aria-label="Close popup"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Trophy Icon */}
            <motion.div 
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.1 }}
              className="w-24 h-24 sm:w-28 sm:h-28 mb-6 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 flex items-center justify-center shadow-xl shadow-amber-500/30 border-4 border-amber-200/90 relative"
            >
              <span className="text-5xl sm:text-6xl drop-shadow-md">🏆</span>
            </motion.div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-amber-400 uppercase tracking-[0.25em] mb-2">
                🎉 WINNER ANNOUNCED 🎉
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">
                {displayName}
              </h1>
              <p className="text-xs font-mono text-slate-400 font-semibold mb-6">
                Ticket Code: <span className="text-amber-300">#{winner?.winnerTicket}</span>
              </p>
            </div>
            
            {/* Prize Box */}
            <div className="w-full bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl mb-6 shadow-inner flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PRIZE CATEGORY</span>
              <span className="text-2xl font-black text-emerald-400">
                {winner?.prizeName}
              </span>
              {winner?.prizeItem && (
                <span className="text-xs font-bold text-yellow-300 mt-1 bg-yellow-400/10 px-3 py-0.5 rounded-full border border-yellow-400/30">
                  {winner.prizeItem}
                </span>
              )}
            </div>
            
            {/* Resuming Timer */}
            <div className="flex items-center gap-3 bg-slate-800/60 px-5 py-2 rounded-full border border-slate-700/60 text-xs font-semibold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {isTimerLagging ? 'Synchronizing...' : `Game resuming in ${countdown}s`}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WinnerPopup;
