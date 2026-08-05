import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GameStatusTimer = ({ gameState, countdown = 5, pauseCountdown = 0, isMobile = false }) => {
  const wrapperClasses = "flex items-center gap-3";
  const timerTextClasses = "text-sm font-bold text-brand-primary min-w-[28px] tabular-nums text-center inline-block";

  return (
    <AnimatePresence mode="wait">
      {gameState === 'LIVE' && (
        <motion.div 
          key="live"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={isMobile ? "flex flex-col gap-3" : wrapperClasses}
        >
          <div className={isMobile ? "flex items-center gap-2 bg-white border border-sky-100 px-3 py-2 rounded-full shadow-sm" : "flex items-center gap-2 bg-brand-secondary/10 border border-brand-secondary/20 px-3 py-1.5 rounded-full"}>
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className={isMobile ? "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" : "w-2.5 h-2.5 rounded-full bg-brand-secondary shadow-sm"}
            />
            <span className={isMobile ? "text-xs font-bold text-emerald-700 uppercase tracking-wider" : "text-xs font-bold text-brand-secondary uppercase tracking-wider"}>Running</span>
          </div>
          {isMobile && <span className="h-px w-full bg-slate-200" />}
          <div className={isMobile ? "flex items-center gap-1.5 bg-sky-50 px-3 py-2 rounded-full border border-sky-100" : "flex items-center gap-1.5 bg-brand-primary/5 px-3 py-1.5 rounded-full border border-brand-primary/10"}>
            <span className={isMobile ? "text-xs font-semibold text-sky-700" : "text-xs font-semibold text-brand-text-sec"}>⏳ Timer:</span>
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
          className={isMobile ? "flex flex-col gap-3" : wrapperClasses}
        >
          <div className={isMobile ? "flex items-center gap-2 bg-white border border-orange-100 px-3 py-2 rounded-full shadow-sm" : "flex items-center gap-2 bg-brand-warning/10 border border-brand-warning/20 px-3 py-1.5 rounded-full"}>
            <div className={isMobile ? "w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_#F59E0B]" : "w-2.5 h-2.5 rounded-full bg-brand-warning shadow-[0_0_8px_#F59E0B]"} />
            <span className={isMobile ? "text-xs font-bold text-orange-700 uppercase tracking-wider" : "text-xs font-bold text-brand-warning uppercase tracking-wider"}>Paused</span>
          </div>
          {isMobile && <span className="h-px w-full bg-slate-200" />}
          <div className={isMobile ? "flex items-center gap-1.5 bg-orange-50 px-3 py-2 rounded-full border border-orange-100" : "flex items-center gap-1.5 bg-brand-warning/5 px-3 py-1.5 rounded-full border border-brand-warning/10"}>
             <span className={isMobile ? "text-xs font-semibold text-orange-700 min-w-[70px] tabular-nums" : "text-xs font-semibold text-brand-warning min-w-[70px] tabular-nums"}>
               {pauseCountdown > 0 ? `Wait ${pauseCountdown}s` : '⏸ Waiting...'}
             </span>
          </div>
        </motion.div>
      )}

      {gameState === 'WAITING' && (
        <motion.div 
          key="waiting"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className={isMobile ? "flex items-center gap-2 bg-white border border-orange-100 px-4 py-1.5 rounded-full shadow-sm" : "flex items-center gap-2 bg-brand-text-sec/10 border border-brand-text-sec/20 px-4 py-1.5 rounded-full"}
        >
          <span className={isMobile ? "text-xs font-bold text-orange-700 uppercase tracking-wider" : "text-xs font-bold text-brand-text-sec uppercase tracking-wider"}>Waiting for Host</span>
        </motion.div>
      )}

      {gameState === 'COMPLETED' && (
        <motion.div 
          key="completed"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className={isMobile ? "flex items-center gap-2 bg-white border border-sky-100 px-4 py-1.5 rounded-full shadow-sm" : "flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 px-4 py-1.5 rounded-full"}
        >
          <span className={isMobile ? "text-xs font-bold text-sky-700 uppercase tracking-wider" : "text-xs font-bold text-brand-primary uppercase tracking-wider"}>Game Over</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(GameStatusTimer);
