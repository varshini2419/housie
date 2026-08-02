import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WinnerPopup = ({ winner, countdown, onClose }) => {

  const displayName = winner?.winnerName && winner.winnerName.trim() !== '' && winner.winnerName !== 'Player' 
    ? winner.winnerName 
    : `Ticket #${winner?.winnerTicket}`;

  return (
    <AnimatePresence>
      {winner && (
        <motion.div 
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Blurred Backdrop */}
          <div className="absolute inset-0 bg-white/20 backdrop-blur-2xl"></div>
          
          {/* CSS Confetti / Sparkles background handled in index.css via classes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center opacity-70">
             <div className="confetti-overlay"></div>
          </div>

          {/* Main Glassmorphism Card */}
          <motion.div 
            initial={{ scale: 0.8, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 bg-white/80 backdrop-blur-3xl p-8 sm:p-12 rounded-[2rem] border border-white/60 shadow-[0_30px_80px_rgba(0,0,0,0.1),_inset_0_1px_1px_rgba(255,255,255,1)] flex flex-col items-center text-center max-w-lg w-full"
          >
            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/30 hover:bg-white/80 transition-all duration-200 shadow-sm hover:shadow-md text-gray-400 hover:text-gray-700 z-50 focus:outline-none"
                aria-label="Close popup"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Trophy Icon */}
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.2 }}
              className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center shadow-[0_15px_30px_rgba(245,158,11,0.4)] border-4 border-white"
            >
              <span className="text-5xl">🏆</span>
            </motion.div>
            
            {/* Winner Name */}
            <motion.h2 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-sm sm:text-base font-bold text-[#00C16E] uppercase tracking-widest mb-2"
            >
              Winner Announced!
            </motion.h2>
            
            <motion.h1 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1B2430] mb-6 leading-tight tracking-tight"
            >
              Congratulations!
            </motion.h1>
            
            {/* Prize Name */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
              className={`bg-[#00C16E]/10 border border-[#00C16E]/20 px-6 py-3 rounded-2xl ${winner?.prizeItem ? 'mb-4' : 'mb-6'}`}
            >
              <p className="text-2xl sm:text-3xl font-extrabold text-[#00a85e]">
                🏆 {winner?.prizeName}
              </p>
            </motion.div>

            {/* Prize Item (Optional) */}
            {winner?.prizeItem && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
                className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-8 py-3.5 rounded-2xl mb-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] flex flex-col items-center max-w-full"
              >
                <p className="text-[#d97706] text-[11px] uppercase font-bold tracking-widest mb-1.5 flex items-center gap-1.5">
                  <span className="text-lg">🎁</span> Prize
                </p>
                <p className="text-xl sm:text-2xl font-black text-[#F59E0B] truncate max-w-[250px] sm:max-w-[300px]">
                  {winner?.prizeItem}
                </p>
              </motion.div>
            )}

            {/* Winner Details */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              className="flex flex-col items-center mb-8"
            >
              <p className="text-[#6B7280] text-xs uppercase font-bold tracking-widest mb-1">
                Winner
              </p>
              <span className="text-2xl font-black text-[#4F8EF7]">
                {displayName}
              </span>
            </motion.div>
            
            {/* Countdown */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="flex flex-col items-center"
            >
              <p className="text-[#6B7280] text-xs font-semibold uppercase tracking-widest mb-2">
                Resuming in...
              </p>
              <div className="w-12 h-12 rounded-full border border-[#4F8EF7]/30 flex items-center justify-center text-xl font-bold text-[#4F8EF7] bg-[#4F8EF7]/10 tabular-nums">
                {countdown}
              </div>
            </motion.div>
            
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WinnerPopup;
