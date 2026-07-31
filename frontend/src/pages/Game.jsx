import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import ThemeToggle from '../components/ThemeToggle';
import WinnerPopup from '../components/WinnerPopup';
import GameStatusTimer from '../components/GameStatusTimer';

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, ticket } = useGameStore();
  const socketRef = useRef(null);

  const [gameState, setGameState] = useState('WAITING');
  const [currentNumber, setCurrentNumber] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [totalJoined, setTotalJoined] = useState(1);
  const [prizes, setPrizes] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [nextDrawCountdown, setNextDrawCountdown] = useState(null);
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const isSpeakingStateRef = useRef(false);

  const setSpeaking = (val) => {
    isSpeakingStateRef.current = val;
    setIsSpeakingState(val);
  };

  // New UI States for Mobile Layout
  const [activeTab, setActiveTab] = useState('game'); // 'game', 'prizes', 'history'
  const [isBoardExpanded, setIsBoardExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const [winnerQueue, setWinnerQueue] = useState([]);
  const [activeWinner, setActiveWinner] = useState(null);

  const { isVoiceEnabled, toggleVoice, announceNumber, announceWinner, unlockAudio } = useSpeech();
  const isVoiceEnabledRef = useRef(isVoiceEnabled);

  useEffect(() => {
    isVoiceEnabledRef.current = isVoiceEnabled;
  }, [isVoiceEnabled]);

  // Continuous local 1s countdown tick for smooth UI countdown 5s -> 4s -> 3s -> 2s -> 1s -> 0s
  // Strictly pauses while voice is speaking, starts 5s countdown immediately after speech ends
  useEffect(() => {
    if (gameState !== 'LIVE' || isSpeakingState || nextDrawCountdown === null || nextDrawCountdown <= 0) return;

    const timer = setTimeout(() => {
      setNextDrawCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameState, isSpeakingState, nextDrawCountdown]);

  useEffect(() => {
    if (!ticket || !ticket.ticketCode) {
      navigate('/');
      return;
    }

    socketRef.current = io(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000'));

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_game', {
        sessionId,
        ticketCode: ticket.ticketCode,
        role: 'player'
      });
    });

    socketRef.current.on('player_count_update', ({ onlineCount, totalPlayers }) => {
      setOnlineCount(onlineCount);
      if (totalPlayers) setTotalJoined(totalPlayers);
    });

    socketRef.current.on('game_sync', (data) => {
      setGameState(data.status);
      setCurrentNumber(data.currentNumber);
      setDrawnNumbers(data.drawnNumbers);
      setPrizes(data.prizes);
      if (data.markedNumbers) {
        setMarkedNumbers(data.markedNumbers);
      }
    });

    socketRef.current.on('number_drawn', ({ number, drawnNumbers }) => {
      setCurrentNumber(number);
      setDrawnNumbers(drawnNumbers);
      setNextDrawCountdown(5);
      if (isVoiceEnabledRef.current) {
        setSpeaking(true);
        announceNumber(number);
      } else {
        setSpeaking(false);
      }
    });

    socketRef.current.on('countdown_update', ({ countdown }) => {
      if (!isSpeakingStateRef.current && countdown !== null && countdown !== undefined) {
        setNextDrawCountdown(countdown);
      }
    });

    socketRef.current.on('game_started', () => setGameState('LIVE'));

    socketRef.current.on('game_paused', ({ winners, countdown }) => {
      setGameState('PAUSED');
      if (countdown !== undefined) setPauseCountdown(countdown);
    });

    socketRef.current.on('pause_countdown_tick', ({ countdown }) => {
      setPauseCountdown(countdown);
    });

    socketRef.current.on('game_resumed', () => setGameState('LIVE'));
    socketRef.current.on('game_ended', () => setGameState('COMPLETED'));

    socketRef.current.on('game_deleted', () => {
      alert('The session was deleted by the host.');
      navigate('/');
    });

    socketRef.current.on('claim_result', ({ success, message, prizeId, prizeName, winnerTicket, winnerName, prizeItem }) => {
      setToastMsg(message);
      setTimeout(() => setToastMsg(null), 4000);

      if (success) {
        setWinnerQueue(prev => [...prev, { prizeName, winnerTicket, winnerName, prizeItem }]);
        setPrizes(prevPrizes => prevPrizes.map(p => {
          if (p.id === prizeId) {
            return { ...p, status: 'COMPLETED', winnerTicket, winner: winnerName, prizeItem: prizeItem || p.prizeItem };
          }
          return p;
        }));
      }
    });

    const handleSpeechFinished = () => {
      if (socketRef.current) {
        socketRef.current.emit('speech_finished', { sessionId });
      }
      // Wait for 2 seconds (2000ms) after speech ends completely before starting the 5s countdown
      setTimeout(() => {
        setSpeaking(false);
        setNextDrawCountdown(5);
      }, 2000);
    };
    window.addEventListener('speech_finished', handleSpeechFinished);

    return () => {
      window.removeEventListener('speech_finished', handleSpeechFinished);
      if (socketRef.current) {
        socketRef.current.off('player_count_update');
        socketRef.current.off('game_sync');
        socketRef.current.off('number_drawn');
        socketRef.current.off('countdown_update');
        socketRef.current.off('game_started');
        socketRef.current.off('game_paused');
        socketRef.current.off('pause_countdown_tick');
        socketRef.current.off('game_resumed');
        socketRef.current.off('game_ended');
        socketRef.current.off('game_deleted');
        socketRef.current.off('claim_result');
        socketRef.current.disconnect();
      }
    };
  }, [sessionId, ticket, navigate]);

  useEffect(() => {
    if (!activeWinner && winnerQueue.length > 0) {
      const next = winnerQueue[0];
      setActiveWinner(next);
      
      const isPlayer = !next.winnerName || next.winnerName.trim() === '' || next.winnerName === 'Player';
      const text = isPlayer
        ? `Congratulations! Ticket Number ${next.winnerTicket} won ${next.prizeName}.`
        : `Congratulations ${next.winnerName}! You won ${next.prizeName}.`;
      
      announceWinner(text);
    }
  }, [winnerQueue, activeWinner, announceWinner]);

  const handlePopupClose = () => {
    setActiveWinner(null);
    setWinnerQueue(prev => prev.slice(1));
  };

  const isDrawn = (num) => drawnNumbers.includes(num);
  const isMarked = (num) => markedNumbers.includes(num);

  const claimPrize = (prizeId) => {
    if (gameState !== 'LIVE') return;
    socketRef.current.emit('claim_prize', { sessionId, ticketCode: ticket.ticketCode, prizeId });
  };

  const handleMarkNumber = (num) => {
    if (gameState !== 'LIVE') return;
    if (num === 0) return;
    if (!isDrawn(num)) return;
    if (isMarked(num)) return;
    
    setMarkedNumbers(prev => [...prev, num]);
    socketRef.current.emit('mark_number', { sessionId, ticketCode: ticket.ticketCode, number: num });
  };

  if (!ticket || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg text-brand-text p-8 text-center">
        <div className="w-16 h-16 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
        <p className="text-xl font-bold text-brand-text-sec animate-pulse tracking-wide">Loading Game Session...</p>
        <p className="text-xs text-brand-text-muted mt-3 font-medium uppercase tracking-wider">Please wait</p>
      </div>
    );
  }

  // Helper for Number Name
  const getNumberName = (num) => {
    if(!num) return 'Waiting...';
    return `Number ${num}`; 
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative pb-20 md:pb-0" onClick={unlockAudio}>
      
      {/* Background Orbs (Kept for both) */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] mix-blend-screen z-0 opacity-60"></div>
      <div className="pointer-events-none fixed -bottom-40 -right-40 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] mix-blend-screen z-0 opacity-60"></div>

      {toastMsg && (
        <div className="fixed top-20 right-4 left-4 md:left-auto md:right-8 md:top-8 bg-white border-l-4 border-emerald-500 text-slate-800 p-4 rounded-2xl shadow-xl z-[100] animate-bounce flex items-center gap-3">
          <span className="text-xl">🎉</span>
          <span className="font-semibold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* ===================== DESKTOP VIEW (UNTOUCHED) ===================== */}
      <div className="hidden md:block">
        {/* Sticky Compact Header (Desktop) */}
        <div className="sticky top-0 z-50 h-[60px] glass-panel rounded-none border-x-0 border-t-0 flex justify-between items-center px-8 w-full">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-lg">Tambola</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-brand-blue text-[10px] font-mono font-bold">
              #{ticket.ticketCode}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-semibold text-emerald-600">{onlineCount} Online</span>
            </div>
            <button onClick={toggleVoice} className="text-xl opacity-80 hover:opacity-100 transition-opacity">
              {isVoiceEnabled ? '🔊' : '🔈'}
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full relative z-10 px-8 pt-8 grid grid-cols-3 gap-6">
          {/* Left Column (Desktop) */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center justify-center pt-2 pb-4">
              <div className="relative">
                {gameState === 'PAUSED' && <div className="absolute inset-0 bg-amber-500/20 animate-pulse rounded-full blur-xl pointer-events-none"></div>}
                <div key={currentNumber} className={`w-40 h-40 rounded-full flex items-center justify-center current-number-card ${gameState === "LIVE" ? "live-glow animate-draw-pulse" : ""}`}>
                  <span className="text-[6rem] font-black tracking-tighter leading-none mt-2 animate-number-enter">
                    {currentNumber || '-'}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-brand-text-sec font-bold text-sm tracking-widest uppercase">
                {getNumberName(currentNumber)}
              </p>
              
              {/* Fixed Status Area */}
              <div className="mt-5 flex flex-row items-center justify-center gap-3 bg-brand-card border border-brand-border px-5 py-2.5 rounded-full shadow-sm w-72 max-w-full">
                <GameStatusTimer gameState={gameState} nextDrawCountdown={nextDrawCountdown} pauseCountdown={pauseCountdown} isMobile={false} />
              </div>
            </div>

            <div className="w-full">
               <div className="ticket-container p-4 shadow-premium w-full mx-auto max-w-lg ticket-active-glow relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none"></div>
                  <div className="grid grid-cols-9 gap-1.5 w-full relative z-10">
                    {(ticket?.ticketMatrix || []).map((row, rIndex) => (
                      row.map((num, cIndex) => {
                        const marked = num !== 0 && isMarked(num);
                        const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';
                        return (
                          <div 
                            key={`r${rIndex}-c${cIndex}`} 
                            onClick={() => handleMarkNumber(num)}
                            className={`aspect-square flex items-center justify-center text-xl font-extrabold rounded-xl border transition-all duration-400 relative select-none
                              ${num === 0 ? 'ticket-cell-empty' : 'ticket-cell shadow-sm'}
                              ${marked ? 'ticket-cell-marked' : ''}
                              ${canMark ? 'cursor-pointer hover:border-blue-500 hover:scale-110 hover:shadow-lg ring-2 ring-blue-500/30' : ''}`}
                          >
                            {num === 0 ? '' : num}
                          </div>
                        );
                      })
                    ))}
                  </div>
               </div>
            </div>
          </div>

          {/* Right Column (Desktop) */}
          <div className="flex flex-col gap-6 col-span-2">
            <div className="w-full">
              <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider mb-3">Claim Prizes</h2>
              <div className="flex flex-wrap gap-3 w-full">
                {(prizes || []).filter(p => p.enabled).map(prize => {
                  const isWon = prize.status === 'COMPLETED';
                  const isLocked = prize.status === 'LOCKED';
                  const wonByMe = isWon && prize.winnerTicket === ticket.ticketCode;
                  return (
                    <button 
                      key={prize.id} disabled={isWon || isLocked || gameState !== 'LIVE'} onClick={() => claimPrize(prize.id)}
                      className={`shrink-0 min-w-[140px] max-w-[220px] p-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all duration-200 border shadow-sm h-auto
                        ${isWon ? (wonByMe ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/40 text-white shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 opacity-75') 
                          : (isLocked ? 'bg-brand-bg text-brand-text-muted border-brand-border cursor-not-allowed'
                          : (gameState !== 'LIVE' ? 'bg-brand-bg text-brand-text-muted border-brand-border' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/30 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]'))}
                        disabled:cursor-not-allowed cursor-pointer text-center whitespace-normal`}
                    >
                      <span className="text-sm">🏆 {prize.name}</span>
                      <span className={`text-[11px] font-medium leading-tight mt-0.5 break-words ${isWon && wonByMe ? 'text-emerald-100' : (!isWon && !isLocked && gameState === 'LIVE' ? 'text-blue-100' : 'text-brand-text-sec')}`}>
                        🎁 {prize.prizeItem || 'Prize to be announced'}
                      </span>
                      {isWon && <span className="text-[10px] font-mono opacity-80 uppercase mt-1">{prize.winner}</span>}
                      {!isWon && isLocked && <span className="text-[10px] uppercase opacity-75 mt-1">Locked 🔒</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="w-full glass-panel p-6 mt-2">
              <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                🏆 Winners Board
              </h2>
              <div className="flex flex-col gap-4">
                {prizes.filter(p => p.enabled).map(prize => {
                  const isWon = prize.status === 'COMPLETED';
                  return (
                    <div key={`win-${prize.id}`} className={`flex flex-col p-4 rounded-2xl bg-brand-bg border transition-all duration-300 shadow-sm ${isWon ? 'border-l-4 border-l-emerald-500 border-t-brand-border border-r-brand-border border-b-brand-border bg-emerald-500/5' : 'border-brand-border hover:shadow-md'}`}>
                      <span className="text-sm font-bold text-brand-text mb-3">🏆 {prize.name}</span>
                      
                      {prize.prizeItem && (
                        <div className="mb-3 flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">🎁 Prize</span>
                          <span className="text-xs font-semibold text-brand-text-sec">{prize.prizeItem}</span>
                        </div>
                      )}

                      {isWon ? (
                        <div className="flex flex-col mt-auto pt-3 border-t border-brand-border">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted mb-0.5">Winner</span>
                          <span className="text-sm font-extrabold text-emerald-500">{prize.winner}</span>
                          {prize.winnerTicket && <span className="text-[10px] font-mono text-brand-text-muted mt-1">Ticket #{prize.winnerTicket}</span>}
                        </div>
                      ) : (
                        <div className="mt-auto pt-3 border-t border-brand-border">
                           <span className="text-xs font-semibold text-brand-text-muted italic opacity-70">Waiting...</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="glass-panel p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider">Recent Draws</h2>
                <span className="text-xs font-semibold text-brand-text-muted bg-brand-bg px-2.5 py-1 rounded-full border border-brand-border">
                  {drawnNumbers.length} / 90
                </span>
              </div>
              <div className="flex flex-wrap gap-3 mb-6">
                {drawnNumbers.slice(-10).map(num => (
                  <div key={`rec-${num}`} className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_4px_10px_rgba(37,99,235,0.3)] animate-draw-pulse">
                    {num}
                  </div>
                ))}
                {drawnNumbers.length === 0 && <span className="text-sm text-brand-text-muted italic">No numbers drawn yet.</span>}
              </div>
              <button onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} className="w-full py-3 text-sm font-bold text-brand-blue border border-brand-border rounded-xl hover:bg-brand-bg transition-colors shadow-sm">
                {isHistoryExpanded ? 'Collapse Full History' : 'View Full History'}
              </button>
              {isHistoryExpanded && (
                <div className="mt-4 p-4 bg-brand-bg rounded-2xl border border-brand-border max-h-48 overflow-y-auto grid grid-cols-10 gap-2.5 shadow-inner">
                  {drawnNumbers.map(num => (
                    <div key={`hist-${num}`} className="flex items-center justify-center p-2 rounded-xl text-xs font-bold bg-brand-card text-brand-text border border-brand-border shadow-sm">
                      {num}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-5">
               <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider">Number Board (1-90)</h2>
                <button onClick={() => setIsBoardExpanded(!isBoardExpanded)} className="text-xs font-bold text-brand-blue bg-blue-500/10 px-3 py-1.5 rounded-full">
                  {isBoardExpanded ? 'Hide' : 'Expand'}
                </button>
              </div>
              {isBoardExpanded && (
                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                    <div key={`board-${num}`} className={`flex items-center justify-center aspect-square rounded-lg text-xs font-bold transition-all duration-300 ${isDrawn(num) ? 'board-cell drawn animate-draw-pulse' : 'board-cell'}`}>
                      {num}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================== MOBILE VIEW ===================== */}
      <div className="md:hidden flex flex-col w-full relative z-10 pb-28">
        
        {/* Mobile Sticky Header */}
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm px-4 py-3 flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800 text-lg">Tambola</span>
            <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold shadow-sm">
              #{ticket.ticketCode}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-bold text-emerald-700">{onlineCount}</span>
            </div>
            <button onClick={toggleVoice} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-lg shadow-sm active:scale-95 transition-transform">
              {isVoiceEnabled ? '🔊' : '🔈'}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="w-full px-4 pt-4">
          
          {/* TAB 1: GAME */}
          <div className={`flex flex-col gap-6 ${activeTab === 'game' ? 'block' : 'hidden'}`}>
            
            {/* Mobile Hero: Current Number */}
            <div className="flex flex-col items-center justify-center relative">
              <div className="relative">
                {gameState === 'PAUSED' && <div className="absolute inset-0 bg-amber-400/30 animate-pulse rounded-full blur-2xl pointer-events-none"></div>}
                <div key={currentNumber} className={`w-40 h-40 rounded-full flex items-center justify-center bg-white border-4 border-slate-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] relative overflow-hidden z-10 ${gameState === "LIVE" ? "border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)] animate-draw-pulse" : ""}`}>
                   <span className="text-[6.5rem] font-black text-slate-800 tracking-tighter leading-none mt-2 relative z-10 animate-number-enter">
                     {currentNumber || '-'}
                   </span>
                   {gameState === "LIVE" && <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-transparent opacity-50"></div>}
                </div>
              </div>
              
              {/* Fixed Status Area */}
              <div className="mt-5 flex flex-row items-center justify-center gap-3 bg-white border border-slate-200 px-5 py-2.5 rounded-full shadow-sm min-w-[240px]">
                <GameStatusTimer gameState={gameState} nextDrawCountdown={nextDrawCountdown} pauseCountdown={pauseCountdown} isMobile={true} />
              </div>
            </div>

            {/* Mobile Recent Chips */}
            <div className="w-full mt-2">
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide snap-x px-1">
                {drawnNumbers.slice(-15).reverse().map((num, i) => (
                  <div key={`mob-rec-${num}`} className={`shrink-0 snap-start flex items-center justify-center font-bold shadow-sm rounded-full ${i === 0 ? 'w-12 h-12 text-white bg-gradient-to-br from-blue-500 to-indigo-600 text-lg shadow-blue-500/30' : 'w-10 h-10 text-slate-600 bg-white border border-slate-200 text-sm opacity-80'}`}>
                    {num}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Ticket Card */}
            <div className="w-full bg-white p-4 rounded-3xl ticket-active-glow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none"></div>
              <div className="flex justify-between items-center mb-3 px-1 relative z-10">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Ticket</h2>
                 <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">ACTIVE</span>
              </div>
              
              <div className="grid grid-cols-9 gap-1 sm:gap-1.5 w-full bg-[#F8FAFC] p-2 rounded-2xl border border-slate-200 shadow-inner relative z-10">
                {(ticket?.ticketMatrix || []).map((row, rIndex) => (
                  row.map((num, cIndex) => {
                    const marked = num !== 0 && isMarked(num);
                    const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';
                    return (
                      <div 
                        key={`mob-r${rIndex}-c${cIndex}`} 
                        onClick={() => handleMarkNumber(num)}
                        className={`aspect-square flex items-center justify-center text-sm font-black rounded-[8px] transition-all duration-400 select-none
                          ${num === 0 ? 'bg-transparent' : 'bg-white text-slate-800 shadow-sm border border-slate-200/60'}
                          ${marked ? 'ticket-cell-marked ring-2 ring-emerald-200/50' : ''}
                          ${canMark ? 'cursor-pointer animate-pulse ring-2 ring-blue-400/50' : ''}`}
                      >
                        {num === 0 ? '' : num}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            {/* PRIZES & WINNERS BOARD (Moved below ticket) */}
            <div className="w-full mt-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Claim Prizes</h2>
              <div className="flex flex-wrap gap-2.5 w-full">
                {(prizes || []).filter(p => p.enabled).map(prize => {
                  const isWon = prize.status === 'COMPLETED';
                  const isLocked = prize.status === 'LOCKED';
                  const wonByMe = isWon && prize.winnerTicket === ticket.ticketCode;
                  
                  return (
                    <button 
                      key={`mob-claim-${prize.id}`}
                      disabled={isWon || isLocked || gameState !== 'LIVE'}
                      onClick={() => claimPrize(prize.id)}
                      className={`flex-grow p-4 min-w-[140px] rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 border shadow-sm text-center h-auto whitespace-normal
                        ${isWon 
                          ? (wonByMe ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-transparent shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 border-slate-200') 
                          : (isLocked ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                          : (gameState !== 'LIVE' ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent shadow-blue-500/20'))}
                      `}
                    >
                      <span className="text-[13px]">🏆 {prize.name}</span>
                      <span className={`text-[11px] font-medium leading-tight mt-0.5 break-words ${isWon && wonByMe ? 'text-emerald-100' : (!isWon && !isLocked && gameState === 'LIVE' ? 'text-blue-100' : 'text-slate-500')}`}>
                        🎁 {prize.prizeItem || 'Prize to be announced'}
                      </span>
                      {isWon && <span className="text-[10px] font-black uppercase tracking-wider opacity-90 mt-1">{prize.winner}</span>}
                      {!isWon && isLocked && <span className="text-[10px] uppercase opacity-60 mt-1">Locked 🔒</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="w-full mt-2 pb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                🏆 Winners Board
              </h2>
              <div className="flex flex-col gap-3">
                {prizes.filter(p => p.enabled).map(prize => {
                  const isWon = prize.status === 'COMPLETED';
                  return (
                    <div key={`mob-win-${prize.id}`} className={`flex flex-col p-5 rounded-3xl bg-white border transition-all shadow-sm ${isWon ? 'border-emerald-200 shadow-emerald-500/10' : 'border-slate-100'}`}>
                      <span className="text-sm font-bold text-slate-800 mb-3">🏆 {prize.name}</span>
                      
                      {prize.prizeItem && (
                        <div className="mb-4 flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">🎁 Prize</span>
                          <span className="text-sm font-semibold text-slate-600">{prize.prizeItem}</span>
                        </div>
                      )}

                      {isWon ? (
                        <div className="flex flex-col pt-3 border-t border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Winner</span>
                          <span className="text-sm font-extrabold text-emerald-500">{prize.winner}</span>
                          {prize.winnerTicket && <span className="text-[10px] font-mono text-slate-400 mt-1">Ticket #{prize.winnerTicket}</span>}
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-slate-100">
                          <span className="text-xs font-semibold text-slate-400 italic">Waiting...</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TAB 3: HISTORY */}
          <div className={`flex flex-col gap-6 ${activeTab === 'history' ? 'block' : 'hidden'}`}>
            <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
               <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Number Board (1-90)</h2>
              </div>
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                  <div 
                    key={`mob-board-${num}`}
                    className={`flex items-center justify-center aspect-square rounded-[6px] text-[10px] font-bold transition-all duration-300
                      ${isDrawn(num) ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-400 border border-slate-100'}
                    `}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Bottom Nav */}
        <div className="fixed bottom-6 left-6 right-6 h-16 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-[0_15px_50px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center px-4 z-50 rounded-full">
          <button onClick={() => setActiveTab('game')} className={`flex flex-col items-center justify-center w-1/2 h-full transition-all duration-300 ${activeTab === 'game' ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`text-xl mb-1 transition-transform ${activeTab === 'game' ? 'scale-110' : 'grayscale opacity-60'}`}>🎟️</span>
            <span className="text-[10px] font-bold">Game</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center w-1/2 h-full transition-all duration-300 ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`text-xl mb-1 transition-transform ${activeTab === 'history' ? 'scale-110' : 'grayscale opacity-60'}`}>🔢</span>
            <span className="text-[10px] font-bold">Board</span>
          </button>
        </div>
      </div>

      <WinnerPopup winner={activeWinner} onClose={handlePopupClose} />
    </div>
  );
};

export default Game;
