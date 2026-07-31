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
      if (countdown !== null && countdown !== undefined) {
        setNextDrawCountdown(countdown);
      }
    };

    const handleNumberDrawn = () => {
      setNextDrawCountdown(5);
    };

    socketRef.current.on('game_paused', handlePaused);
    socketRef.current.on('pause_countdown_tick', handlePauseTick);
    socketRef.current.on('countdown_update', handleCountdownUpdate);
    socketRef.current.on('number_drawn', handleNumberDrawn);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('game_paused', handlePaused);
        socketRef.current.off('pause_countdown_tick', handlePauseTick);
        socketRef.current.off('countdown_update', handleCountdownUpdate);
        socketRef.current.off('number_drawn', handleNumberDrawn);
      }
    };
  }, [socketRef]);

  // Continuous local 1s countdown tick for smooth UI countdown 5s -> 4s -> 3s -> 2s -> 1s -> 0s
  useEffect(() => {
    if (gameState !== 'LIVE' || nextDrawCountdown === null) return;

    const interval = setInterval(() => {
      setNextDrawCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, nextDrawCountdown === null]);

  // Tabular numbers and fixed minimum width prevent the layout from shifting when text length changes.
  const liveTimerClasses = isMobile 
    ? "text-blue-600 font-black inline-block min-w-[32px] text-center tabular-nums"
    : "text-blue-500 font-mono text-base inline-block min-w-[32px] text-center tabular-nums";
    
  if (gameState === 'LIVE') {
    return (
      <span className={`text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${isMobile ? 'text-slate-700' : 'text-brand-text-sec'}`}>
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        Next draw in: <strong className="text-blue-500 font-mono text-sm sm:text-base font-black tabular-nums">{nextDrawCountdown !== null ? nextDrawCountdown : 5}s</strong>
      </span>
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
