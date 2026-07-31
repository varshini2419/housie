import React from 'react';

const GameStatusTimer = ({ gameState, nextDrawCountdown, pauseCountdown = 0, isMobile = false }) => {
  if (gameState === 'LIVE') {
    const countdownVal = (nextDrawCountdown !== null && nextDrawCountdown !== undefined) ? nextDrawCountdown : 5;
    return (
      <span className="text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 text-slate-700">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        Next draw in: <strong className="text-blue-600 font-mono text-sm sm:text-base font-black tabular-nums">{countdownVal}s</strong>
      </span>
    );
  } else if (gameState === 'PAUSED') {
    return (
      <>
        <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5 shrink-0"><span className="text-lg">🟡</span> Paused</span>
        <span className="text-slate-300 mx-1 shrink-0">|</span>
        <span className="text-sm font-bold tabular-nums inline-block min-w-[100px] text-left shrink-0 whitespace-nowrap text-slate-600">
          ⏸ {pauseCountdown > 0 ? `Waiting ${pauseCountdown}s` : 'Waiting...'}
        </span>
      </>
    );
  } else if (gameState === 'WAITING') {
    return (
      <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5 shrink-0 whitespace-nowrap">⏳ Waiting for Host{isMobile ? '' : '...'}</span>
    );
  } else {
    return (
      <span className="text-sm font-bold text-blue-600 flex items-center gap-1.5 shrink-0 whitespace-nowrap">🏁 {isMobile ? 'Completed' : 'Game Completed'}</span>
    );
  }
};

export default React.memo(GameStatusTimer);
