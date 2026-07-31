import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import GameStatusTimer from '../components/GameStatusTimer';
import WinnerPopup from '../components/WinnerPopup';

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, ticket } = useGameStore();

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

  // UI States
  const [autoMark, setAutoMark] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBoardExpanded, setIsBoardExpanded] = useState(false);

  const [winnerQueue, setWinnerQueue] = useState([]);
  const [activeWinner, setActiveWinner] = useState(null);

  const socketRef = useRef(null);

  const { isVoiceEnabled, toggleVoice, announceNumber, announceWinner, unlockAudio } = useSpeech();
  const isVoiceEnabledRef = useRef(isVoiceEnabled);

  useEffect(() => {
    isVoiceEnabledRef.current = isVoiceEnabled;
  }, [isVoiceEnabled]);

  // Force pure light/white theme for User UI page
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }, []);

  // Smooth local 1s countdown tick for guaranteed 5s -> 4s -> 3s -> 2s -> 1s -> 0s display
  useEffect(() => {
    if (gameState !== 'LIVE' || isSpeakingState || nextDrawCountdown === null || nextDrawCountdown <= 0) return;

    const timer = setInterval(() => {
      setNextDrawCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isSpeakingState, nextDrawCountdown !== null && nextDrawCountdown > 0]);

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

      // Auto Mark feature support
      if (autoMark && ticket?.ticketMatrix) {
        const flatNums = ticket.ticketMatrix.flat();
        if (flatNums.includes(number) && !markedNumbers.includes(number)) {
          setMarkedNumbers(prev => [...prev, number]);
          socketRef.current.emit('mark_number', { sessionId, ticketCode: ticket.ticketCode, number });
        }
      }

      if (isVoiceEnabledRef.current) {
        setSpeaking(true);
        announceNumber(number);
      } else {
        setSpeaking(false);
      }
    });

    socketRef.current.on('countdown_update', ({ countdown }) => {
      if (!isSpeakingStateRef.current && countdown !== null && countdown !== undefined) {
        if (countdown === 5 || nextDrawCountdown === null) {
          setNextDrawCountdown(countdown);
        }
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
      setSpeaking(false);
      setNextDrawCountdown(5);
      if (socketRef.current) {
        socketRef.current.emit('speech_finished', { sessionId });
      }
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
  }, [sessionId, ticket, navigate, autoMark, markedNumbers]);

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  if (!ticket || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-slate-800 p-8 text-center font-sans">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6 shadow-lg shadow-blue-500/20"></div>
        <p className="text-xl font-bold text-slate-700 animate-pulse tracking-wide">Loading Game Session...</p>
        <p className="text-xs text-slate-400 mt-3 font-medium uppercase tracking-wider">Please wait</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-slate-800 relative pb-12 font-sans select-none" onClick={unlockAudio}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-4 left-4 md:left-auto md:right-8 md:top-8 bg-white border-l-4 border-emerald-500 text-slate-800 p-4 rounded-2xl shadow-2xl z-[100] animate-bounce flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <span className="font-bold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs px-4 sm:px-8 py-3.5 flex justify-between items-center w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <span className="font-black text-2xl text-blue-600 tracking-tight">Tambola</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-600 text-xs font-black shadow-xs">
            #{ticket.ticketCode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full items-center gap-2 shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-emerald-700">{onlineCount} Online Players</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleVoice} 
            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-lg shadow-xs transition-all active:scale-95 cursor-pointer border border-slate-200/80 text-slate-700"
            title="Toggle Voice"
          >
            {isVoiceEnabled ? '🔊' : '🔈'}
          </button>

          <button 
            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-base shadow-xs transition-all cursor-pointer border border-slate-200/80 text-slate-700"
            title="Help"
          >
            ❓
          </button>

          <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full border border-slate-200/80 cursor-pointer shadow-xs">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              👤
            </div>
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">Player One</span>
            <span className="text-xs text-slate-400">▾</span>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          
          {/* ===================== LEFT COLUMN (col-span-3) ===================== */}
          <div className="lg:col-span-3 flex flex-col gap-5 sm:gap-6">
            
            {/* CURRENT DRAW CARD */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center relative">
              <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span>✦</span> CURRENT DRAW <span>✦</span>
              </p>

              {/* Glowing Circle */}
              <div className="relative my-2">
                <div key={currentNumber} className={`w-36 h-36 rounded-full bg-white border-4 border-blue-500/80 flex items-center justify-center shadow-lg shadow-blue-500/20 relative ${gameState === "LIVE" ? "animate-draw-pulse" : ""}`}>
                  <span className="text-6xl font-black text-slate-800 tracking-tighter leading-none animate-number-enter">
                    {currentNumber || '-'}
                  </span>
                </div>
              </div>

              {/* Timer Pill Badge */}
              <div className="mt-4 bg-slate-100/90 border border-slate-200/80 px-4 py-1.5 rounded-full shadow-inner">
                <GameStatusTimer gameState={gameState} nextDrawCountdown={nextDrawCountdown} pauseCountdown={pauseCountdown} isMobile={false} />
              </div>
            </div>

            {/* RECENT NUMBERS CARD */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>RECENT NUMBERS</span>
                <span className="text-slate-400 font-normal">🕒</span>
              </h2>

              <div className="grid grid-cols-5 gap-2.5">
                {drawnNumbers.slice(-10).reverse().map((num, i) => (
                  <div 
                    key={`left-rec-${num}-${i}`}
                    className={`w-11 h-11 aspect-square rounded-full flex items-center justify-center font-black text-sm transition-all ${i === 0 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105' : 'bg-slate-100 text-slate-700 border border-slate-200/60'}`}
                  >
                    {num}
                  </div>
                ))}
              </div>
              {drawnNumbers.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-2">No numbers drawn yet.</p>
              )}
            </div>

            {/* GAME INFO CARD */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1">
                GAME INFO
              </h2>

              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">🎮 Game ID</span>
                  <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                    TB-2451 <span className="text-slate-400 text-[10px]">📋</span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">👥 Players</span>
                  <span className="font-bold text-slate-800">{onlineCount}</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">🎟️ Tickets Sold</span>
                  <span className="font-bold text-slate-800">{totalJoined}</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500 flex items-center gap-2">🕒 Start Time</span>
                  <span className="font-mono font-bold text-slate-800">08:45 PM</span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="font-bold text-slate-500 flex items-center gap-2">☑️ Auto Mark</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${autoMark ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {autoMark ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== MIDDLE COLUMN (col-span-6) ===================== */}
          <div className="lg:col-span-6 flex flex-col gap-5 sm:gap-6">
            
            {/* CLAIM PRIZES ROW */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>🎁 CLAIM PRIZES</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
                {(prizes || []).filter(p => p.enabled).map((prize, idx) => {
                  const isWon = prize.status === 'COMPLETED';
                  const isLocked = prize.status === 'LOCKED';
                  const wonByMe = isWon && prize.winnerTicket === ticket.ticketCode;
                  const isFullHouse = prize.name.toLowerCase().includes('full house');

                  return (
                    <button
                      key={`claim-grid-${prize.id}`}
                      disabled={isWon || isLocked || gameState !== 'LIVE'}
                      onClick={() => claimPrize(prize.id)}
                      className={`p-3.5 rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all duration-200 border text-center cursor-pointer min-h-[105px]
                        ${isWon 
                          ? (wonByMe ? 'bg-emerald-500 text-white border-transparent shadow-md shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed') 
                          : (isFullHouse 
                            ? 'bg-gradient-to-b from-amber-50 to-yellow-50/80 border-amber-200 hover:border-amber-400 text-amber-900 shadow-xs' 
                            : (idx === 0 
                              ? 'bg-blue-50/40 border-2 border-blue-500 text-blue-900 shadow-xs' 
                              : 'bg-slate-50/70 border-slate-200/80 text-slate-800 hover:bg-blue-50/50 hover:border-blue-300'))}
                      `}
                    >
                      <span className="text-xs font-black flex items-center gap-1">
                        {isFullHouse ? '👑' : (idx === 0 ? '🏆' : (idx === 1 ? '🥈' : '🥉'))} {prize.name}
                      </span>
                      <span className={`text-base font-black ${isWon && wonByMe ? 'text-white' : (isFullHouse ? 'text-amber-700' : 'text-blue-600')}`}>
                        ₹ {prize.prizeItem || (idx === 0 ? '500' : (idx === 1 ? '1,000' : (idx === 2 ? '1,500' : (idx === 3 ? '2,000' : '5,000'))))}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {isWon ? '1 Winner' : '0 Winner'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* YOUR TICKET CARD (Tambola Matrix Grid) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs relative">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-black text-blue-900 uppercase tracking-wider">
                  YOUR TICKET
                </h2>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60">
                  <span>Ticket #{ticket.ticketCode}</span>
                  <span className="text-slate-400 text-[10px]">📋</span>
                </div>
              </div>

              {/* Tambola Ticket Matrix */}
              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200/80 shadow-inner">
                <div className="grid grid-cols-9 gap-2.5 w-full">
                  {(ticket?.ticketMatrix || []).map((row, rIndex) => (
                    row.map((num, cIndex) => {
                      const marked = num !== 0 && isMarked(num);
                      const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';

                      return (
                        <div 
                          key={`mid-cell-${rIndex}-${cIndex}`}
                          onClick={() => handleMarkNumber(num)}
                          className={`aspect-square flex items-center justify-center text-lg sm:text-xl font-black rounded-2xl transition-all duration-300 select-none
                            ${num === 0 ? 'bg-transparent border-none' : 'bg-white text-slate-800 border border-slate-200/90 shadow-xs'}
                            ${marked ? 'bg-emerald-500 text-white rounded-full font-black shadow-md shadow-emerald-500/30 scale-105 border-transparent' : ''}
                            ${canMark ? 'cursor-pointer ring-2 ring-blue-400/80 animate-pulse' : ''}`}
                        >
                          {num === 0 ? '' : num}
                        </div>
                      );
                    })
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 pt-3 flex items-center justify-center gap-6 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Called</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-200"></span> Not Called</span>
                <span className="flex items-center gap-1.5">⭐ Free Space</span>
              </div>
            </div>

            {/* BOTTOM CONTROLS BAR (4 Action Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              
              {/* Card 1: Auto Mark */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                    🤖
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800">Auto Mark</span>
                    <span className="text-[10px] text-slate-400 leading-tight">Numbers marked automatically</span>
                  </div>
                </div>
                <button 
                  onClick={() => setAutoMark(!autoMark)}
                  className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center shrink-0 cursor-pointer ${autoMark ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

              {/* Card 2: Sound */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                    🔊
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800">Sound</span>
                    <span className="text-[10px] text-slate-400 leading-tight">Sound alerts for new numbers</span>
                  </div>
                </div>
                <button 
                  onClick={toggleVoice}
                  className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center shrink-0 cursor-pointer ${isVoiceEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

              {/* Card 3: Quick View */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                    👁️
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800">Quick View</span>
                    <span className="text-[10px] text-slate-400 leading-tight">View all your tickets</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Fullscreen */}
              <div 
                onClick={toggleFullscreen}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                    ⛶
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800">Fullscreen</span>
                    <span className="text-[10px] text-slate-400 leading-tight">Enjoy a better experience</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* ===================== RIGHT COLUMN (col-span-3) ===================== */}
          <div className="lg:col-span-3 flex flex-col gap-5 sm:gap-6">
            
            {/* WINNERS CARD */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>🏆 WINNERS</span>
                </h2>

                <div className="flex flex-col gap-3">
                  {prizes.filter(p => p.enabled).map((prize, idx) => {
                    const isWon = prize.status === 'COMPLETED';
                    return (
                      <div 
                        key={`right-win-${prize.id}`}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${isWon ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50/60 border-slate-200/60'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">
                            {isWon ? '🏆' : (idx === 0 ? '🏆' : (idx === 1 ? '🥈' : '🥉'))}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800">{prize.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {isWon ? `${prize.winner} • Ticket #${prize.winnerTicket}` : 'Waiting for winner...'}
                            </span>
                          </div>
                        </div>

                        {isWon ? (
                          <span className="text-base animate-bounce">🎉</span>
                        ) : (
                          <span className="text-xs text-slate-400">🕒</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button className="w-full mt-5 py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold border border-blue-200/80 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                👥 View All Winners
              </button>
            </div>

            {/* FULL HOUSE BANNER CARD */}
            <div className="bg-gradient-to-br from-purple-100 via-indigo-50 to-purple-50 p-6 rounded-3xl border border-purple-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[180px]">
              
              {/* Golden Trophy Icon on right */}
              <div className="absolute right-3 bottom-2 text-6xl opacity-90 drop-shadow-md pointer-events-none">
                🏆
              </div>

              <div>
                <span className="text-xs font-black text-purple-900 uppercase tracking-wider block mb-1">
                  Full House
                </span>
                <p className="text-[11px] font-semibold text-purple-600 mb-3">
                  The ultimate win!
                </p>
                <p className="text-3xl font-black text-purple-800 tracking-tight">
                  ₹ 5,000
                </p>
              </div>

              <p className="text-[10px] font-bold text-purple-500 mt-4">
                Be the next champion!
              </p>
            </div>

            {/* BOARD EXPANDABLE CARD (1-90) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider">
                  Number Board (1-90)
                </h2>
                <button 
                  onClick={() => setIsBoardExpanded(!isBoardExpanded)}
                  className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 cursor-pointer"
                >
                  {isBoardExpanded ? 'Hide' : 'Expand'}
                </button>
              </div>

              {isBoardExpanded && (
                <div className="grid grid-cols-10 gap-1.5 pt-3">
                  {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                    <div 
                      key={`mid-board-${num}`}
                      className={`flex items-center justify-center aspect-square rounded-lg text-[10px] font-bold transition-all duration-300 ${isDrawn(num) ? 'bg-blue-600 text-white font-black shadow-xs' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      <WinnerPopup winner={activeWinner} onClose={handlePopupClose} />
    </div>
  );
};

export default Game;
