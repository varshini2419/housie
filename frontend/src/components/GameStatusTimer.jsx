import React from 'react';

const GameStatusTimer = ({ gameState, nextDrawCountdown, pauseCountdown = 0, isSpeaking = false, isMobile = false }) => {
  if (gameState === 'LIVE') {
    if (isSpeaking) {
      return (
        <span className="text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 text-indigo-700 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
          <span>🔊 Announcing Number...</span>
        </span>
      );
    }

    const countdownVal = (nextDrawCountdown !== null && nextDrawCountdown !== undefined) ? nextDrawCountdown : 5;
    
    // Dynamic color shift based on remaining seconds
    const timerColorClass = countdownVal <= 2 
      ? 'text-emerald-600 animate-pulse' 
      : (countdownVal <= 4 ? 'text-blue-600' : 'text-indigo-600');

    return (
      <span className="text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 text-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
        <span>Next draw in:</span>
        <strong className={`font-mono text-sm sm:text-base font-black tabular-nums ${timerColorClass}`}>
          {countdownVal}s
        </strong>
      </span>
    );
  } else if (gameState === 'PAUSED') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm font-bold text-amber-600 flex items-center gap-1.5 shrink-0 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>Paused</span>
        </span>
        <span className="text-xs sm:text-sm font-bold tabular-nums text-slate-600">
          {pauseCountdown > 0 ? `Resuming in ${pauseCountdown}s` : 'Winner Popup...'}
        </span>
      </div>
    );
  } else if (gameState === 'WAITING') {
    return (
      <span className="text-xs sm:text-sm font-bold text-amber-600 flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
        <span>⏳</span> Waiting for Host to start...
      </span>
    );
  } else {
    return (
      <span className="text-xs sm:text-sm font-bold text-blue-600 flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
        <span>🏁</span> {isMobile ? 'Game Ended' : 'Game Session Completed'}
      </span>
    );
  }
};

export default React.memo(GameStatusTimer);
