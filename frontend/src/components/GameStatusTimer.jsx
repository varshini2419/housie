import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GameStatusTimer = ({ gameState, nextDrawCountdown, countdown = 5, pauseCountdown = 0, isSpeaking = false, timerData = {}, isMobile = false }) => {
  const effectiveCountdown = (nextDrawCountdown !== null && nextDrawCountdown !== undefined) ? nextDrawCountdown : countdown;

  if (gameState === 'LIVE') {
    const phase = timerData?.phase || (effectiveCountdown < 5 ? 'COUNTDOWN' : 'SPEECH_WAIT');
    const subPhase = timerData?.subPhase || (isSpeaking ? 'SPEAKING' : 'PAUSE');

    if (phase === 'SPEECH_WAIT') {
      if (subPhase === 'SPEAKING' || isSpeaking) {
        return (
          <span className="text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap text-indigo-600 dark:text-indigo-400 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
            <span>🔊 Announcing Number...</span>
          </span>
        );
      } else {
        const pRemaining = timerData?.pauseRemaining !== undefined ? timerData.pauseRemaining : 2;
        return (
          <span className="text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap text-amber-600 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>⏳ Waiting {pRemaining > 0 ? `${pRemaining}s` : '1s'}...</span>
          </span>
        );
      }
    }

    const timerColorClass = effectiveCountdown <= 2 
      ? 'text-emerald-600 dark:text-emerald-400 animate-pulse font-black' 
      : (effectiveCountdown <= 4 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-indigo-600 dark:text-indigo-400 font-bold');

    return (
      <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Next draw in:</span>
        <span className={`font-mono text-sm sm:text-base tabular-nums bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs ${timerColorClass}`}>
          {effectiveCountdown}s
        </span>
      </div>
    );
  } else if (gameState === 'PAUSED') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 shrink-0 bg-amber-100/90 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-300 dark:border-amber-800 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>Game Paused</span>
        </span>
        <span className="text-xs sm:text-sm font-bold tabular-nums text-slate-600 dark:text-slate-400">
          {pauseCountdown > 0 ? `Resuming in ${pauseCountdown}s` : 'Claim Verification'}
        </span>
      </div>
    );
  } else if (gameState === 'WAITING') {
    return (
      <span className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 whitespace-nowrap bg-amber-50 dark:bg-amber-950/40 px-3.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 shadow-xs">
        <span className="animate-spin">⏳</span>
        <span>Waiting for Host to start...</span>
      </span>
    );
  } else {
    return (
      <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2 whitespace-nowrap bg-slate-100 dark:bg-slate-900 px-3.5 py-1 rounded-full border border-slate-300 dark:border-slate-800 shadow-xs">
        <span>🏁</span>
        <span>{isMobile ? 'Game Ended' : 'Game Session Completed'}</span>
      </span>
    );
  }
};

export default React.memo(GameStatusTimer);
