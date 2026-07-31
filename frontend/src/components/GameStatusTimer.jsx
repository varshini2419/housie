import React, { useState, useEffect } from 'react';

const GameStatusTimer = ({ gameState, socketRef, isMobile = false }) => {
  const [nextDrawCountdown, setNextDrawCountdown] = useState(null);
  const [pauseCountdown, setPauseCountdown] = useState(0);

  useEffect(() => {
    if (!socketRef || !socketRef.current) return;

    const handlePaused = ({ countdown }) => {
      if (countdown !== undefined) setPauseCountdown(countdown);
    };
    
    const handlePauseTick = ({ countdown }) => {
      setPauseCountdown(countdown);
    };
    
    const handleCountdownUpdate = ({ countdown }) => {
      setNextDrawCountdown(countdown);
    };

    socketRef.current.on('game_paused', handlePaused);
    socketRef.current.on('pause_countdown_tick', handlePauseTick);
    socketRef.current.on('countdown_update', handleCountdownUpdate);

    return () => {
      socketRef.current.off('game_paused', handlePaused);
      socketRef.current.off('pause_countdown_tick', handlePauseTick);
      socketRef.current.off('countdown_update', handleCountdownUpdate);
    };
  }, [socketRef]);

  // Tabular numbers and fixed minimum width prevent the layout from shifting when text length changes.
  const liveTimerClasses = isMobile 
    ? "text-blue-600 font-black inline-block min-w-[32px] text-center tabular-nums"
    : "text-blue-500 font-mono text-base inline-block min-w-[32px] text-center tabular-nums";
    
  if (gameState === 'LIVE') {
    return (
      <>
        <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Running</span>
        <span className={`${isMobile ? "text-slate-300" : "text-brand-border"} mx-1 shrink-0`}>|</span>
        <span className={`text-sm font-bold flex flex-row items-center whitespace-nowrap shrink-0 ${isMobile ? 'text-slate-600' : 'text-brand-text-sec'}`}>
          ⏳ Timer: <span className={liveTimerClasses}>{nextDrawCountdown !== null ? nextDrawCountdown : 0}s</span>
        </span>
      </>
    );
  } else if (gameState === 'PAUSED') {
    return (
      <>
        <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5 shrink-0"><span className="text-lg">🟡</span> Paused</span>
        <span className={`${isMobile ? "text-slate-300" : "text-brand-border"} mx-1 shrink-0`}>|</span>
        <span className={`text-sm font-bold tabular-nums inline-block min-w-[100px] text-left shrink-0 whitespace-nowrap ${isMobile ? 'text-slate-600' : 'text-brand-text-sec'}`}>
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
