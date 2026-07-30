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

  return (
    <div className="min-h-screen bg-brand-bg p-4 sm:p-8 flex flex-col items-center relative overflow-hidden" onClick={unlockAudio}>
      {/* Background Orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

      {toastMsg && (
        <div className="fixed top-8 right-8 bg-brand-card border-l-4 border-brand-emerald text-brand-text p-4 rounded-2xl shadow-premium-lg z-50 animate-bounce flex items-center gap-3">
          <span className="text-xl">🎉</span>
          <span className="font-semibold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="glass-panel p-6 rounded-3xl shadow-premium border border-brand-border flex flex-col sm:flex-row justify-between items-start sm:items-center w-full max-w-6xl mb-8 gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Welcome, {ticket.playerName || 'Player'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-brand-blue text-xs font-mono font-bold">
              #{ticket.ticketCode}
            </span>
          </div>
          <p className="text-brand-text-sec text-sm font-medium">Session: <strong className="text-brand-text">{session.sessionName}</strong></p>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {onlineCount} / {totalJoined} Players Online
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button 
              onClick={toggleVoice}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-semibold text-sm transition-all border cursor-pointer ${isVoiceEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'bg-brand-card border-brand-border text-brand-text-muted hover:bg-brand-bg'}`}
            >
              {isVoiceEnabled ? '🔊 Voice ON' : '🔈 Voice OFF'}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8 z-10">
        
        {/* Left Column: Status, Current Number & Claims */}
        <div className="flex flex-col gap-6">
          {/* Status Card */}
          <div className="glass-panel rounded-3xl p-6 shadow-premium border border-brand-border flex flex-col items-center relative overflow-hidden text-center">
            {gameState === 'PAUSED' && <div className="absolute inset-0 bg-amber-500/10 animate-pulse pointer-events-none"></div>}
            <h2 className="text-xs text-brand-text-muted mb-2 font-bold uppercase tracking-wider">Game Status</h2>
            {gameState === 'WAITING' && <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-sm font-bold animate-pulse">⏳ Waiting Room...</div>}
            {gameState === 'LIVE' && <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-sm font-bold">🟢 Game Live</div>}
            {gameState === 'PAUSED' && <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-sm font-bold">⏸️ Game Paused</div>}
            {gameState === 'COMPLETED' && <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-sm font-bold">🏁 Game Completed</div>}
          </div>

          {/* Current Number Card */}
          <div className="glass-panel rounded-3xl p-6 shadow-premium border border-brand-border flex flex-col items-center text-center relative">
            <h2 className="text-xs text-brand-text-muted mb-4 font-bold uppercase tracking-wider">Current Drawn Number</h2>
            <div className={`w-32 h-32 rounded-full flex items-center justify-center shadow-lg border-4 transition-all duration-300 ${gameState === 'LIVE' ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-blue-500/30 shadow-2xl border-blue-400/40' : 'bg-slate-100 dark:bg-slate-800 text-brand-text dark:text-white border-brand-border'}`}>
              <span className="text-6xl font-extrabold tracking-tight">
                {currentNumber || '-'}
              </span>
            </div>
          </div>

          {/* Claim Buttons Card */}
          <div className="glass-panel rounded-3xl p-6 shadow-premium border border-brand-border relative">
            {gameState === 'PAUSED' && (
              <div className="absolute inset-0 bg-brand-card/95 backdrop-blur-md z-20 flex flex-col items-center justify-center rounded-3xl p-6 text-center">
                <span className="text-2xl mb-1 animate-bounce">🏆</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold text-lg mb-1">Winner Announced!</span>
                <span className="text-brand-text-muted text-xs mb-3">Game Paused - Prize Verification</span>
                {pauseCountdown > 0 ? (
                  <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">Resuming in {pauseCountdown}s</span>
                ) : (
                  <span className="text-brand-text-muted text-xs italic">Waiting for host resume...</span>
                )}
              </div>
            )}
            <h2 className="text-xs text-brand-text-muted mb-4 font-bold uppercase tracking-wider">Claimable Prizes</h2>
            <div className="flex flex-col gap-3">
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
                      w-full py-3.5 px-4 rounded-2xl font-bold flex justify-between items-center transition-all duration-200 text-sm border shadow-sm
                      ${isWon 
                        ? (wonByMe ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/40 text-white shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 border-slate-200 dark:border-slate-700/60 line-through opacity-75') 
                        : (isLocked ? 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : (gameState !== 'LIVE' ? 'bg-brand-bg text-brand-text-muted border-brand-border' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-400/30 hover:shadow-md hover:shadow-blue-500/25 hover:-translate-y-0.5 active:scale-[0.98]'))}
                      disabled:cursor-not-allowed cursor-pointer
                    `}
                  >
                    <span>{prize.name}</span>
                    {isWon && <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/10">{prize.winnerTicket}</span>}
                    {isLocked && <span className="text-xs font-mono uppercase opacity-75">Locked 🔒</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Center & Right Column: Ticket & History */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Ticket Card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-premium border border-brand-border overflow-hidden relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl text-brand-text font-bold tracking-tight">
                Your Tambola Ticket
              </h2>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-sm font-bold">
                Ticket #{ticket.ticketCode}
              </span>
            </div>
            
            <div className="grid grid-cols-9 gap-1.5 bg-slate-100 dark:bg-slate-950 p-3 rounded-2xl border border-brand-border shadow-inner">
              {(ticket?.ticketMatrix || []).map((row, rIndex) => (
                row.map((num, cIndex) => {
                  const marked = num !== 0 && isMarked(num);
                  const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';
                  
                  return (
                    <div 
                      key={`r${rIndex}-c${cIndex}`} 
                      onClick={() => handleMarkNumber(num)}
                      className={`
                        aspect-square flex items-center justify-center text-lg sm:text-xl font-extrabold rounded-xl border transition-all duration-200 relative select-none
                        ${num === 0 ? 'bg-transparent border-transparent' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'}
                        ${marked ? 'text-brand-text-muted opacity-90 dark:text-slate-400' : 'text-brand-text'}
                        ${canMark ? 'cursor-pointer hover:border-blue-500 hover:scale-105 hover:shadow-md ring-2 ring-blue-500/30' : ''}
                      `}
                    >
                      {num === 0 ? '' : num}
                      
                      {marked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-[120%] h-1 bg-red-500 rotate-[-45deg] rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          {/* History Card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-premium border border-brand-border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm text-brand-text-muted font-bold uppercase tracking-wider">Draw History</h2>
              <span className="text-xs font-semibold text-brand-text-muted bg-brand-bg px-3 py-1 rounded-full border border-brand-border">
                Drawn: <strong className="text-brand-text">{drawnNumbers.length}</strong> / 90
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
              {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                <div 
                  key={num}
                  className={`
                    flex items-center justify-center p-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-300
                    ${isDrawn(num) ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/30' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}
                  `}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Leaderboard Cards */}
      <div className="w-full max-w-6xl mt-10 mb-8 z-10">
        <h2 className="text-lg font-bold text-brand-text mb-4 flex items-center gap-2">
          <span>🏆</span> Winners Leaderboard
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {prizes.filter(p => p.enabled).map(prize => {
            const isWon = prize.status === 'COMPLETED';
            const name = prize.winner || '';
            const code = prize.winnerTicket || '';
            return (
              <div key={prize.id} className="glass-panel p-4 rounded-2xl border-l-4 border-l-brand-emerald border-y border-r border-brand-border shadow-sm hover:shadow-md transition-all">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm block mb-1.5">{prize.name}</span>
                {isWon ? (
                  <div className="text-xs text-brand-text-sec">
                    <p>Winner: <strong className="text-brand-text font-bold">{name}</strong></p>
                    <p className="text-brand-text-muted text-[11px] font-mono mt-0.5">Ticket #{code}</p>
                  </div>
                ) : (
                  <p className="text-brand-text-muted text-xs italic">{prize.status === 'LOCKED' ? 'Locked 🔒' : 'Waiting...'}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Game;
