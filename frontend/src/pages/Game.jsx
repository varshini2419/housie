import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import ThemeToggle from '../components/ThemeToggle';

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
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [nextDrawCountdown, setNextDrawCountdown] = useState(null);

  // New UI States for Mobile Layout
  const [activeTab, setActiveTab] = useState('game'); // 'game', 'prizes', 'history'
  const [isBoardExpanded, setIsBoardExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const { isVoiceEnabled, toggleVoice, announceNumber, unlockAudio } = useSpeech();

  useEffect(() => {
    if (!ticket || !ticket.ticketCode) {
      navigate('/');
      return;
    }

    socketRef.current = io(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000'));

    socketRef.current.emit('join_game', {
      sessionId,
      ticketCode: ticket.ticketCode,
      role: 'player'
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
      announceNumber(number);
    });

    socketRef.current.on('game_started', () => setGameState('LIVE'));

    socketRef.current.on('game_paused', ({ winners, countdown }) => {
      setGameState('PAUSED');
      if (countdown !== undefined) setPauseCountdown(countdown);
    });

    socketRef.current.on('pause_countdown_tick', ({ countdown }) => {
      setPauseCountdown(countdown);
    });

    socketRef.current.on('countdown_update', ({ countdown }) => {
      setNextDrawCountdown(countdown);
    });

    socketRef.current.on('game_resumed', () => setGameState('LIVE'));
    socketRef.current.on('game_ended', () => setGameState('COMPLETED'));

    socketRef.current.on('game_deleted', () => {
      alert('The session was deleted by the host.');
      navigate('/');
    });

    socketRef.current.on('claim_result', ({ success, message, prizeId, winnerTicket, winnerName }) => {
      setToastMsg(message);
      setTimeout(() => setToastMsg(null), 4000);

      if (success) {
        setPrizes(prevPrizes => prevPrizes.map(p => {
          if (p.id === prizeId) {
            return { ...p, status: 'COMPLETED', winnerTicket, winner: winnerName };
          }
          return p;
        }));
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [sessionId, ticket, navigate]);

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
    <div className="min-h-screen bg-brand-bg relative pb-20 md:pb-0" onClick={unlockAudio}>
      
      {/* Background Orbs */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge z-0"></div>
      <div className="pointer-events-none fixed -bottom-40 -right-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge z-0"></div>

      {toastMsg && (
        <div className="fixed top-20 right-4 left-4 md:left-auto md:right-8 md:top-8 bg-brand-card border-l-4 border-brand-emerald text-brand-text p-4 rounded-2xl shadow-premium-lg z-[100] animate-bounce flex items-center gap-3">
          <span className="text-xl">🎉</span>
          <span className="font-semibold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Sticky Compact Header (Mobile & Desktop) */}
      <div className="sticky top-0 z-50 h-[60px] glass-panel rounded-none border-x-0 border-t-0 flex justify-between items-center px-4 w-full">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-lg">Tambola</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-brand-blue text-[10px] font-mono font-bold">
            #{ticket.ticketCode}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{onlineCount} Online</span>
          </div>
          <button onClick={toggleVoice} className="text-xl opacity-80 hover:opacity-100 transition-opacity">
            {isVoiceEnabled ? '🔊' : '🔈'}
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full relative z-10 px-0 sm:px-4 md:px-8 pt-4 md:pt-8 flex flex-col md:grid md:grid-cols-3 gap-6">
        
        {/* TAB 1: GAME (Mobile default) / Left Column (Desktop) */}
        <div className={`flex-col gap-6 ${activeTab === 'game' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Hero: Current Number & Countdown */}
          <div className="flex flex-col items-center justify-center pt-2 pb-4">
            <div className="relative">
              {gameState === 'PAUSED' && <div className="absolute inset-0 bg-amber-500/20 animate-pulse rounded-full blur-xl pointer-events-none"></div>}
              <div className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full flex items-center justify-center current-number-card ${gameState === "LIVE" ? "live-glow animate-draw-pulse" : ""}`}>
                <span className="text-[5rem] sm:text-[6rem] font-black tracking-tighter leading-none mt-2">
                  {currentNumber || '-'}
                </span>
              </div>
            </div>
            
            <p className="mt-4 text-brand-text-sec font-bold text-sm tracking-widest uppercase">
              {getNumberName(currentNumber)}
            </p>

            {gameState === 'LIVE' && nextDrawCountdown !== null && (
              <div className="mt-4 px-5 py-2 rounded-full bg-brand-card border border-brand-border flex items-center gap-3 shadow-md">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-sm font-bold text-brand-text">Next draw in: <span className="text-blue-500 font-mono text-base">{nextDrawCountdown}s</span></span>
              </div>
            )}

            {gameState === 'PAUSED' && (
              <div className="mt-4 px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <span className="text-amber-500 text-lg animate-bounce">🏆</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {pauseCountdown > 0 ? `Resuming in ${pauseCountdown}s` : 'Winner Verification...'}
                </span>
              </div>
            )}
            {gameState === 'WAITING' && (
              <div className="mt-4 px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-bold animate-pulse">
                ⏳ Waiting for Host...
              </div>
            )}
            {gameState === 'COMPLETED' && (
              <div className="mt-4 px-5 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-bold">
                🏁 Game Completed
              </div>
            )}
          </div>

          {/* Ticket Section (Full width on mobile) */}
          <div className="w-full px-2 sm:px-0">
             <div className="ticket-container p-2 sm:p-4 shadow-premium w-full mx-auto max-w-lg">
                <div className="grid grid-cols-9 gap-1 sm:gap-1.5 w-full">
                  {(ticket?.ticketMatrix || []).map((row, rIndex) => (
                    row.map((num, cIndex) => {
                      const marked = num !== 0 && isMarked(num);
                      const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';
                      
                      return (
                        <div 
                          key={`r${rIndex}-c${cIndex}`} 
                          onClick={() => handleMarkNumber(num)}
                          className={`
                            aspect-square flex items-center justify-center text-[1rem] sm:text-xl font-extrabold rounded-lg sm:rounded-xl border transition-all duration-200 relative select-none
                            ${num === 0 ? 'ticket-cell-empty' : 'ticket-cell shadow-sm'}
                            ${marked ? 'ticket-cell-marked' : ''}
                            ${canMark ? 'cursor-pointer hover:border-blue-500 hover:scale-105 hover:shadow-md ring-2 ring-blue-500/30' : ''}
                          `}
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

        {/* TAB 2: PRIZES (Mobile) / Right Column Part 1 (Desktop) */}
        <div className={`flex-col gap-6 ${activeTab === 'prizes' ? 'flex px-4 sm:px-0' : 'hidden md:flex md:col-span-2'}`}>
          
          <div className="w-full">
            <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider mb-3">Claim Prizes</h2>
            {/* Horizontal Scrollable Chips */}
            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x w-full">
              {(prizes || []).filter(p => p.enabled).map(prize => {
                const isWon = prize.status === 'COMPLETED';
                const isLocked = prize.status === 'LOCKED';
                const wonByMe = isWon && prize.winnerTicket === ticket.ticketCode;
                
                return (
                  <button 
                    key={prize.id}
                    disabled={isWon || isLocked || gameState !== 'LIVE'}
                    onClick={() => claimPrize(prize.id)}
                    className={`
                      shrink-0 snap-start py-2.5 px-5 rounded-full font-bold flex flex-col sm:flex-row items-center gap-1 transition-all duration-200 border shadow-sm whitespace-nowrap min-w-[120px] sm:min-w-0
                      ${isWon 
                        ? (wonByMe ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/40 text-white shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 opacity-75') 
                        : (isLocked ? 'bg-brand-bg text-brand-text-muted border-brand-border cursor-not-allowed'
                        : (gameState !== 'LIVE' ? 'bg-brand-bg text-brand-text-muted border-brand-border' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/30 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]'))}
                      disabled:cursor-not-allowed cursor-pointer
                    `}
                  >
                    <span className="text-sm">{prize.name}</span>
                    {isWon && <span className="text-[10px] font-mono opacity-80 uppercase">{prize.winner}</span>}
                    {!isWon && isLocked && <span className="text-[10px] uppercase opacity-75">Locked 🔒</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="w-full glass-panel p-5 mt-2">
            <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              🏆 Winners Board
            </h2>
            <div className="flex flex-col gap-2">
              {prizes.filter(p => p.enabled).map(prize => {
                const isWon = prize.status === 'COMPLETED';
                return (
                  <div key={`win-${prize.id}`} className="flex justify-between items-center p-3 rounded-xl bg-brand-bg border border-brand-border">
                    <span className="text-sm font-bold text-brand-text">{prize.name}</span>
                    {isWon ? (
                      <span className="text-sm font-bold text-emerald-500">{prize.winner}</span>
                    ) : (
                      <span className="text-xs font-semibold text-brand-text-muted italic">Waiting...</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* TAB 3: HISTORY (Mobile) / Right Column Part 2 (Desktop) */}
        <div className={`flex-col gap-6 ${activeTab === 'history' ? 'flex px-4 sm:px-0' : 'hidden md:flex md:col-span-2'}`}>
          
          <div className="glass-panel p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider">Recent Draws</h2>
              <span className="text-xs font-semibold text-brand-text-muted bg-brand-bg px-2.5 py-1 rounded-full border border-brand-border">
                {drawnNumbers.length} / 90
              </span>
            </div>
            
            {/* Show only last 10 drawn numbers natively to save space */}
            <div className="flex flex-wrap gap-2 mb-4">
              {drawnNumbers.slice(-10).map(num => (
                <div key={`rec-${num}`} className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md animate-draw-pulse">
                  {num}
                </div>
              ))}
              {drawnNumbers.length === 0 && <span className="text-sm text-brand-text-muted italic">No numbers drawn yet.</span>}
            </div>
            
            <button 
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full py-2 text-sm font-bold text-brand-blue border border-brand-border rounded-xl hover:bg-brand-bg transition-colors"
            >
              {isHistoryExpanded ? 'Collapse Full History' : 'View Full History'}
            </button>

            {isHistoryExpanded && (
              <div className="mt-4 p-3 bg-brand-bg rounded-xl border border-brand-border max-h-48 overflow-y-auto grid grid-cols-5 sm:grid-cols-10 gap-2">
                {drawnNumbers.map(num => (
                  <div key={`hist-${num}`} className="flex items-center justify-center p-2 rounded-lg text-xs font-bold bg-brand-card text-brand-text border border-brand-border">
                    {num}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel p-5">
             <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider">Number Board (1-90)</h2>
              <button 
                onClick={() => setIsBoardExpanded(!isBoardExpanded)}
                className="text-xs font-bold text-brand-blue bg-blue-500/10 px-3 py-1.5 rounded-full"
              >
                {isBoardExpanded ? 'Hide' : 'Expand'}
              </button>
            </div>

            {isBoardExpanded && (
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                  <div 
                    key={`board-${num}`}
                    className={`
                      flex items-center justify-center aspect-square rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300
                      ${isDrawn(num) ? 'board-cell drawn animate-draw-pulse' : 'board-cell'}
                    `}
                  >
                    {num}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Sticky Bottom Navigation (Mobile Only) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass-panel rounded-none border-x-0 border-b-0 flex justify-around items-center px-2 z-50">
        <button onClick={() => setActiveTab('game')} className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === 'game' ? 'text-brand-blue' : 'text-brand-text-muted'}`}>
          <span className="text-xl mb-0.5">🎟️</span>
          <span className="text-[10px] font-bold">Game</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === 'history' ? 'text-brand-blue' : 'text-brand-text-muted'}`}>
          <span className="text-xl mb-0.5">🔢</span>
          <span className="text-[10px] font-bold">History</span>
        </button>
        <button onClick={() => setActiveTab('prizes')} className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === 'prizes' ? 'text-brand-blue' : 'text-brand-text-muted'}`}>
          <span className="text-xl mb-0.5">🏆</span>
          <span className="text-[10px] font-bold">Prizes</span>
        </button>
      </div>

    </div>
  );
};

export default Game;
