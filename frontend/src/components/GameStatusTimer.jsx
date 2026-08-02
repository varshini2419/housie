import React from 'react';

const GameStatusTimer = ({ gameState, nextDrawCountdown, pauseCountdown = 0, isSpeaking = false, isMobile = false }) => {
  if (gameState === 'LIVE') {
    if (isSpeaking) {
      return (
        <span className="text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap text-indigo-600 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
          <span>🔊 Announcing Number...</span>
        </span>
      );
    }

    const countdownVal = (nextDrawCountdown !== null && nextDrawCountdown !== undefined) ? nextDrawCountdown : 5;
    
    // Dynamic color shift based on remaining seconds
    const timerColorClass = countdownVal <= 2 
      ? 'text-emerald-600 animate-pulse font-black' 
      : (countdownVal <= 4 ? 'text-blue-600 font-bold' : 'text-indigo-600 font-bold');

    return (
      <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Next draw in:</span>
        <span className={`font-mono text-sm sm:text-base tabular-nums bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-xs ${timerColorClass}`}>
          {countdownVal}s
        </span>
      </div>
    );
  } else if (gameState === 'PAUSED') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm font-bold text-amber-700 flex items-center gap-1.5 shrink-0 bg-amber-100/90 px-3 py-1 rounded-full border border-amber-300 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>Game Paused</span>
        </span>
        <span className="text-xs sm:text-sm font-bold tabular-nums text-slate-600">
          {pauseCountdown > 0 ? `Resuming in ${pauseCountdown}s` : 'Claim Verification'}
        </span>
      </div>
    );
  } else if (gameState === 'WAITING') {
    return (
      <span className="text-xs sm:text-sm font-bold text-amber-700 flex items-center gap-2 whitespace-nowrap bg-amber-50 px-3.5 py-1 rounded-full border border-amber-200 shadow-xs">
        <span className="animate-spin">⏳</span>
        <span>Waiting for Host to start...</span>
      </span>
    );
  } else {
    return (
      <span className="text-xs sm:text-sm font-bold text-slate-600 flex items-center gap-2 whitespace-nowrap bg-slate-100 px-3.5 py-1 rounded-full border border-slate-300 shadow-xs">
        <span>🏁</span>
        <span>{isMobile ? 'Game Ended' : 'Game Session Completed'}</span>
      </span>
    );
  }
};

export default React.memo(GameStatusTimer);
