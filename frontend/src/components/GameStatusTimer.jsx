import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GameStatusTimer = ({ gameState, countdown = 5, pauseCountdown = 0, isMobile = false }) => {
  const wrapperClasses = "flex items-center gap-3";
  const timerTextClasses = "text-sm font-bold text-[#4F8EF7] min-w-[28px] tabular-nums text-center inline-block";

  return (
    <AnimatePresence mode="wait">
      {gameState === 'LIVE' && (
        <motion.div 
          key="live"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={wrapperClasses}
        >
          <div className="flex items-center gap-2 bg-[#00C16E]/10 border border-[#00C16E]/20 px-3 py-1.5 rounded-full">
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-2.5 h-2.5 rounded-full bg-[#00C16E] shadow-[0_0_8px_#00C16E]"
            />
            <span className="text-xs font-bold text-[#00a85e] uppercase tracking-wider">Running</span>
          </div>
          <span className="text-[#6B7280]/30 shrink-0">|</span>
          <div className="flex items-center gap-1.5 bg-[#4F8EF7]/5 px-3 py-1.5 rounded-full border border-[#4F8EF7]/10">
            <span className="text-xs font-semibold text-[#6B7280]">⏳ Timer:</span>
            <span className={timerTextClasses}>{countdown}s</span>
          </div>
        </motion.div>
      )}

      {gameState === 'PAUSED' && (
        <motion.div 
          key="paused"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={wrapperClasses}
        >
          <div className="flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-3 py-1.5 rounded-full">
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_8px_#F59E0B]" />
            <span className="text-xs font-bold text-[#d97706] uppercase tracking-wider">Paused</span>
          </div>
          <span className="text-[#6B7280]/30 shrink-0">|</span>
          <div className="flex items-center gap-1.5 bg-[#F59E0B]/5 px-3 py-1.5 rounded-full border border-[#F59E0B]/10">
             <span className="text-xs font-semibold text-[#d97706] min-w-[70px] tabular-nums">
               {pauseCountdown > 0 ? `Wait ${pauseCountdown}s` : '⏸ Waiting...'}
             </span>
          </div>
        </motion.div>
      )}

      {gameState === 'WAITING' && (
        <motion.div 
          key="waiting"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex items-center gap-2 bg-[#6B7280]/10 border border-[#6B7280]/20 px-4 py-1.5 rounded-full"
        >
          <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Waiting for Host</span>
        </motion.div>
      )}

      {gameState === 'COMPLETED' && (
        <motion.div 
          key="completed"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex items-center gap-2 bg-[#4F8EF7]/10 border border-[#4F8EF7]/20 px-4 py-1.5 rounded-full"
        >
          <span className="text-xs font-bold text-[#4F8EF7] uppercase tracking-wider">Game Over</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(GameStatusTimer);
