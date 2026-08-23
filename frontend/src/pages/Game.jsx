import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import WinnerPopup from '../components/WinnerPopup';
import GameStatusTimer from '../components/GameStatusTimer';
import RollingDice from '../components/RollingDice';
import { Check, Ticket, Clock, ChevronRight } from 'lucide-react';

const MemoizedNumberChip = React.memo(({ num, isMarked, isPending, canMark, onMark }) => {
  if (num === 0) {
    return <div className="aspect-square w-full" />;
  }

  return (
    <motion.div 
      onClick={() => onMark(num)}
      whileHover={canMark ? { scale: 1.1, y: -2 } : {}}
      whileTap={canMark ? { scale: 0.95 } : {}}
      className={`aspect-square w-full rounded-full flex items-center justify-center font-black text-sm sm:text-lg relative select-none transition-all duration-300
        ${!isMarked && !isPending ? 'bg-white text-[#0F172A] shadow-[0_4px_10px_rgba(0,0,0,0.06)] border border-white/80' : ''}
        ${isMarked ? 'bg-gradient-to-br from-[#00C16E] to-[#00a85e] text-white border-none shadow-md z-10' : ''}
        ${isPending ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white border-none shadow-md z-10 animate-pulse' : ''}
        ${canMark && !isPending ? 'cursor-pointer ring-2 ring-[#00C16E] shadow-[0_0_12px_rgba(0,193,110,0.3)]' : ''}
      `}
    >
      <span>{num}</span>
      {isMarked && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 rounded-full bg-white border border-[#00C16E] shadow-sm flex items-center justify-center text-[#00a85e] z-20"
        >
          <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
        </motion.div>
      )}
    </motion.div>
  );
});

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, ticket } = useGameStore();
  const socketRef = useRef(null);

  const [gameState, setGameState] = useState('WAITING');
  const [syncStatus, setSyncStatus] = useState('CONNECTING');
  const [currentNumber, setCurrentNumber] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState([]);
  const [pendingMarks, setPendingMarks] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [totalJoined, setTotalJoined] = useState(1);
  const [prizes, setPrizes] = useState([]);
  const [logos, setLogos] = useState(['', '', '']);
  const [toastMsg, setToastMsg] = useState(null);
  const [nextDrawCountdown, setNextDrawCountdown] = useState(5);
  const [pauseCountdown, setPauseCountdown] = useState(0);

  const [activeTab, setActiveTab] = useState('game'); // 'game', 'leaderboard', 'history'
  const [isBoardExpanded, setIsBoardExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Unified popup pipeline (prize-independent): claim_result | pause tick → activeWinner → WinnerPopup
  const [activeWinner, setActiveWinner] = useState(null);
  const [popupInstanceId, setPopupInstanceId] = useState(0);
  const activeWinnerRef = useRef(null);
  const tickZeroFallbackRef = useRef(null);
  const tickWatchdogRef = useRef(null);
  const lastSyncTickRef = useRef(0);
  const isJoiningRef = useRef(false);
  const lastGameSyncRef = useRef(0);
  const [isTimerLagging, setIsTimerLagging] = useState(false);

  const { isVoiceEnabled, toggleVoice, announceNumber, announceWinner, unlockAudio } = useSpeech();

  const makeWinnerKey = (w) => {
    if (!w) return null;
    const id = w.prizeId || w.prizeName;
    if (!id || !w.winnerTicket) return null;
    return `${id}-${w.winnerTicket}-${w.prizeName || ''}`;
  };

  // Removed local popup timing and queuing. Backend handles it entirely.

  useEffect(() => {
    if (!ticket || !ticket.ticketCode) {
      navigate('/');
      return;
    }

    socketRef.current = io(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000'));

    socketRef.current.on('connect', () => {
      if (isJoiningRef.current) return;
      isJoiningRef.current = true;
      socketRef.current.emit('join_game', {
        sessionId,
        ticketCode: ticket.ticketCode,
        role: 'player'
      });
      setTimeout(() => { isJoiningRef.current = false; }, 2000);
    });

    socketRef.current.on('disconnect', () => {
      console.log('[SOCKET] Disconnected');
      if (tickWatchdogRef.current) clearTimeout(tickWatchdogRef.current);
      if (tickZeroFallbackRef.current) clearTimeout(tickZeroFallbackRef.current);
      setIsTimerLagging(false);
    });

    socketRef.current.on('player_count_update', ({ onlineCount, totalPlayers }) => {
      setOnlineCount(onlineCount);
      if (totalPlayers) setTotalJoined(totalPlayers);
    });

    socketRef.current.on('game_sync', (data) => {
      const now = Date.now();
      if (now - lastGameSyncRef.current < 1000) return; // Ignore duplicate syncs from reconnect storms
      lastGameSyncRef.current = now;
      
      if (data.tickId !== undefined) lastSyncTickRef.current = data.tickId;
      setSyncStatus('SYNCED');

      setGameState(data.status);
      if (data.status === 'LIVE') {
        if (tickZeroFallbackRef.current) clearTimeout(tickZeroFallbackRef.current);
        if (tickWatchdogRef.current) clearTimeout(tickWatchdogRef.current);
        setIsTimerLagging(false);
        activeWinnerRef.current = null;
        setActiveWinner(null);
        setPauseCountdown(0);
      }
      setCurrentNumber(data.currentNumber);
      setDrawnNumbers(data.drawnNumbers);
      setPrizes(data.prizes);
      if (data.logos) {
        setLogos(data.logos);
      }
      if (data.markedNumbers) {
        setMarkedNumbers(data.markedNumbers);
      }
    });

    socketRef.current.on('number_drawn', ({ number, drawnNumbers, tickId }) => {
      if (tickId !== undefined) {
          if (tickId < lastSyncTickRef.current) return; // Drop stale events
          lastSyncTickRef.current = tickId;
      }
      setCurrentNumber(number);
      setDrawnNumbers(drawnNumbers);
      announceNumber(number);
    });

    socketRef.current.on('game_started', () => setGameState('LIVE'));

    socketRef.current.on('game_paused', ({ countdown, currentWinner }) => {
      setGameState('PAUSED');
      if (currentWinner && countdown > 0) {
        const key = makeWinnerKey(currentWinner);
        const prevKey = makeWinnerKey(activeWinnerRef.current);
        if (prevKey !== key) {
           setPopupInstanceId(id => id + 1);
           activeWinnerRef.current = currentWinner;
           setActiveWinner(currentWinner);
           const isPlayer = !currentWinner.winnerName || currentWinner.winnerName.trim() === '' || currentWinner.winnerName === 'Player';
           announceWinner(
             isPlayer
               ? `Congratulations! Ticket Number ${currentWinner.winnerTicket} won ${currentWinner.prizeName}.`
               : `Congratulations ${currentWinner.winnerName}! You won ${currentWinner.prizeName}.`
           );
        }
      }
      if (countdown !== undefined) {
        setPauseCountdown(countdown);
      }
    });
    
    socketRef.current.on('pause_countdown_tick', ({ countdown, currentWinner }) => {
      setPauseCountdown(countdown);
      
      if (tickWatchdogRef.current) clearTimeout(tickWatchdogRef.current);
      setIsTimerLagging(false);
      tickWatchdogRef.current = setTimeout(() => {
          setIsTimerLagging(true);
      }, 3000);
      
      if (currentWinner && !activeWinnerRef.current) {
         activeWinnerRef.current = currentWinner;
         setActiveWinner(currentWinner);
      }
      
      if (countdown <= 0) {
        if (tickZeroFallbackRef.current) clearTimeout(tickZeroFallbackRef.current);
        tickZeroFallbackRef.current = setTimeout(() => {
           if (activeWinnerRef.current) {
               console.log('[POPUP] Safe fallback triggered: missed game_resumed');
               activeWinnerRef.current = null;
               setActiveWinner(null);
               setGameState('LIVE');
           }
        }, 2500);
      }
    });
    
    socketRef.current.on('countdown_update', ({ countdown }) => {
      setNextDrawCountdown(countdown);
    });

    socketRef.current.on('game_resumed', () => {
      console.log('[POPUP] game_resumed');
      if (tickZeroFallbackRef.current) clearTimeout(tickZeroFallbackRef.current);
      if (tickWatchdogRef.current) clearTimeout(tickWatchdogRef.current);
      setIsTimerLagging(false);
      setGameState('LIVE');
      setPauseCountdown(0);
      activeWinnerRef.current = null;
      setActiveWinner(null);
    });

    socketRef.current.on('game_ended', () => setGameState('COMPLETED'));

    socketRef.current.on('game_deleted', () => {
      alert('The session was deleted by the host.');
      navigate('/');
    });

    socketRef.current.on('number_marked', ({ number }) => {
      setPendingMarks(prev => prev.filter(n => n !== number));
      setMarkedNumbers(prev => prev.includes(number) ? prev : [...prev, number]);
    });

    socketRef.current.on('ticket_marked', ({ number }) => {
      setMarkedNumbers(prev => prev.includes(number) ? prev : [...prev, number]);
    });

    socketRef.current.on('mark_error', ({ number, message }) => {
      setPendingMarks(prev => prev.filter(n => n !== number));
      setToastMsg(message || 'Failed to mark number');
      setTimeout(() => setToastMsg(null), 4000);
    });

    socketRef.current.on('claim_result', ({ success, message, prizeId, prizeName, winnerTicket, winnerName, prizeItem, sponsor }) => {
      console.log('[POPUP] claim_result received', { success, prizeId, prizeName, winnerTicket });
      setToastMsg(message);
      setTimeout(() => setToastMsg(null), 4000);

      if (success) {
        setPrizes(prevPrizes => prevPrizes.map(p => {
          if (p.id === prizeId || p.name === prizeName) {
            return { ...p, status: 'COMPLETED', winnerTicket, winner: winnerName, prizeItem: prizeItem || p.prizeItem, sponsor: sponsor || p.sponsor };
          }
          return p;
        }));
      }
    });

    return () => {
      if (tickZeroFallbackRef.current) clearTimeout(tickZeroFallbackRef.current);
      if (tickWatchdogRef.current) clearTimeout(tickWatchdogRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [sessionId, ticket?.ticketCode, navigate, announceWinner]);

  const isDrawn = (num) => drawnNumbers.includes(num);
  const isMarked = (num) => markedNumbers.includes(num);

  const claimPrize = (prizeId) => {
    if (gameState !== 'LIVE') return;
    socketRef.current.emit('claim_prize', { sessionId, ticketCode: ticket.ticketCode, prizeId }, (response) => {
      if (!response.success) {
        setToastMsg(response.message);
        setTimeout(() => setToastMsg(null), 4000);
      }
    });
  };

  // Local only — does not resume pause / no socket emit
  const handleBackToGame = useCallback(() => {
    activeWinnerRef.current = null;
    setActiveWinner(null);
    setActiveTab('game');
  }, []);

  const handlePopupClose = handleBackToGame;

  const handleMarkNumber = (num) => {
    if (gameState !== 'LIVE') return;
    if (num === 0) return;
    if (!isDrawn(num)) return;
    if (isMarked(num) || pendingMarks.includes(num)) return;
    
    setPendingMarks(prev => [...prev, num]);
    socketRef.current.emit('mark_number', { sessionId, ticketCode: ticket.ticketCode, number: num });
  };

  if (!ticket || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FC] p-8 text-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-[#00C16E] border-t-transparent rounded-full mb-6 shadow-[0_0_20px_rgba(0,193,110,0.3)]"
        />
        <p className="text-xl font-bold text-[#1B2430]">Loading Game Session</p>
      </div>
    );
  }

  // Generate Ticket Grid matching exact reference UI
  const renderTicket = (isDesktop = true) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`p-5 sm:p-7 w-full mx-auto relative overflow-hidden rounded-[2.5rem] bg-white/95 border border-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.06),inset_0_1px_2px_rgba(255,255,255,1)] ${gameState === 'LIVE' ? 'ring-2 ring-emerald-400/30' : ''}`}
    >
      {/* Top Header Row */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div className="flex items-center gap-3.5">
          {/* Circular 3D Purple Ticket Badge Icon */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] shadow-[0_8px_22px_rgba(124,58,237,0.35)] flex items-center justify-center text-white shrink-0">
            <Ticket className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2] fill-white/20" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-black text-[#0F172A] tracking-wider uppercase leading-none">
              Your Ticket
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[#64748B] mt-1">
              Mark the numbers as they are called!
            </p>
          </div>
        </div>

        {/* Active Pill Badge */}
        <div className="px-4 py-1.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-xs font-black tracking-wider flex items-center gap-2 shadow-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
          <span>ACTIVE</span>
        </div>
      </div>
      
      {/* Inner Ticket Inset Card with Soft Lavender Gradient */}
      <div className="p-3.5 sm:p-5 rounded-[2rem] bg-gradient-to-br from-[#F3F0FF] via-[#F5F3FF] to-[#EDE9FE] border border-[#DDD6FE]/70 shadow-[inset_0_2px_6px_rgba(124,58,237,0.03)] relative overflow-hidden z-10">
        {/* Background Waves & Sparkles */}
        <svg className="absolute bottom-0 right-0 w-56 h-28 text-purple-200/40 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
          <path d="M0,50 Q30,15 60,30 T100,5 L100,50 Z" fill="currentColor"/>
        </svg>
        <span className="absolute top-6 left-10 text-purple-300/70 text-base select-none pointer-events-none">✦</span>
        <span className="absolute bottom-6 right-28 text-purple-300/70 text-lg select-none pointer-events-none">✦</span>

        <div className="grid grid-cols-9 gap-1.5 sm:gap-3 w-full relative z-10">
          {(ticket?.ticketMatrix || []).map((row, rIndex) => (
            row.map((num, cIndex) => {
              const marked = num !== 0 && isMarked(num);
              const pending = num !== 0 && pendingMarks.includes(num);
              const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';
              
              return (
                <MemoizedNumberChip
                  key={`${isDesktop ? 'd' : 'm'}-r${rIndex}-c${cIndex}`}
                  num={num}
                  isMarked={marked}
                  isPending={pending}
                  canMark={canMark}
                  onMark={handleMarkNumber}
                />
              );
            })
          ))}
        </div>
      </div>
    </motion.div>
  );

  // Color themes array for prize cards matching reference image
  const prizeThemes = [
    {
      cardBg: "from-[#EFF6FF] via-[#F8FAFC] to-[#DBEAFE]",
      border: "border-[#BFDBFE]/80",
      waveColor: "text-[#3B82F6]",
      iconBg: "bg-gradient-to-tr from-[#2563EB] to-[#60A5FA]",
      dotColor: "bg-[#3B82F6]",
      textColor: "text-[#1E3A8A]",
    },
    {
      cardBg: "from-[#ECFDF5] via-[#F8FAFC] to-[#D1FAE5]",
      border: "border-[#A7F3D0]/80",
      waveColor: "text-[#10B981]",
      iconBg: "bg-gradient-to-tr from-[#059669] to-[#34D399]",
      dotColor: "bg-[#10B981]",
      textColor: "text-[#064E3B]",
    },
    {
      cardBg: "from-[#F5F3FF] via-[#F8FAFC] to-[#EDE9FE]",
      border: "border-[#DDD6FE]/80",
      waveColor: "text-[#8B5CF6]",
      iconBg: "bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA]",
      dotColor: "bg-[#8B5CF6]",
      textColor: "text-[#4C1D95]",
    },
    {
      cardBg: "from-[#FFFBEB] via-[#F8FAFC] to-[#FEF3C7]",
      border: "border-[#FDE68A]/80",
      waveColor: "text-[#F59E0B]",
      iconBg: "bg-gradient-to-tr from-[#D97706] to-[#FBBF24]",
      dotColor: "bg-[#F59E0B]",
      textColor: "text-[#78350F]",
    },
    {
      cardBg: "from-[#FFF1F2] via-[#F8FAFC] to-[#FFE4E6]",
      border: "border-[#FECDD3]/80",
      waveColor: "text-[#F43F5E]",
      iconBg: "bg-gradient-to-tr from-[#E11D48] to-[#FB7185]",
      dotColor: "bg-[#F43F5E]",
      textColor: "text-[#881337]",
    },
  ];

  // Generate Prizes matching reference UI (Ultra-compact side-by-side cards)
  const renderPrizes = () => (
    <div className="w-full mx-auto relative overflow-hidden rounded-3xl bg-white/95 border border-white/90 p-3.5 sm:p-5 shadow-[0_15px_35px_rgba(15,23,42,0.06),inset_0_1px_2px_rgba(255,255,255,1)] mt-4 sm:mt-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3 relative z-10">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[#4F8EF7] via-[#6366F1] to-[#8B5CF6] shadow-[0_4px_12px_rgba(79,142,247,0.3)] flex items-center justify-center text-white text-base sm:text-lg shrink-0">
          🎁
        </div>
        <div>
          <h2 className="text-xs sm:text-sm font-black text-[#0F172A] tracking-wider uppercase leading-none">
            Claim Prizes
          </h2>
          <div className="flex gap-1 mt-1 opacity-40">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-[#4F8EF7]"></span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Ultra-Compact Side-by-Side Prize Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full relative z-10">
        {(prizes || []).filter(p => p.enabled !== false).map((prize, idx) => {
          const isWon = prize.status === 'COMPLETED';
          const isLocked = prize.status === 'LOCKED';
          const wonByMe = isWon && (prize.winnerTicket === ticket?.ticketCode || prize.winner === ticket?.playerName);
          const canClaim = !isWon && !isLocked && gameState === 'LIVE';

          let bgColor = 'bg-[#2563EB]';
          let textColor = 'text-white';
          let iconBg = 'bg-white/20';

          if (isWon) {
            if (wonByMe) {
              bgColor = 'bg-[#FBBF24]';
              textColor = 'text-[#0F172A]';
              iconBg = 'bg-black/10';
            } else {
              bgColor = 'bg-[#10B981]';
              textColor = 'text-white';
              iconBg = 'bg-black/20';
            }
          }

          return (
            <motion.div
              key={prize.id}
              whileHover={canClaim ? { scale: 1.04, y: -1.5 } : {}}
              whileTap={canClaim ? { scale: 0.96 } : {}}
              onClick={() => canClaim && claimPrize(prize.id)}
              className={`relative overflow-hidden rounded-[1.5rem] px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm transition-all duration-300 select-none flex flex-col gap-1.5 justify-center ${bgColor} ${textColor} ${
                canClaim ? 'cursor-pointer ring-2 ring-blue-400/50 shadow-md' : ''
              } ${!isWon && isLocked ? 'opacity-70 grayscale-[20%]' : ''}`}
            >
              {/* Row 1: Prize Name */}
              <div className="flex items-center gap-2.5 relative z-10 w-full">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                  <span className="text-xs sm:text-sm">🏆</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-black leading-tight tracking-tight truncate">
                    {prize.name}
                  </h3>
                </div>
              </div>

              {/* Row 2: Condition */}
              <div className="flex items-center gap-2.5 relative z-10 w-full">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                  <span className="text-xs sm:text-sm">🎁</span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] sm:text-xs font-semibold opacity-95 truncate block">
                    {prize.prizeItem || 'Prize'}
                  </span>
                </div>
              </div>

              {/* Row 3: Sponsor */}
              <div className="flex items-center gap-2.5 relative z-10 w-full">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                  <span className="text-xs sm:text-sm">🤝</span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] sm:text-xs font-semibold opacity-95 truncate block">
                    {prize.sponsor || '-'}
                  </span>
                </div>
              </div>

              {/* Winner Area (Maintains height even if empty) */}
              <div className="mt-0.5 relative z-10 w-full text-center">
                {isWon ? (
                  <span className="text-[11px] sm:text-xs font-black truncate block px-2">
                    {prize.winner}
                  </span>
                ) : (
                  <span className="text-[11px] sm:text-xs block invisible px-2">
                    Placeholder
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // Generate Winners Board with the colorful theme cards & top tick badges applied!
  const renderWinnersBoard = () => (
    <div className="w-full mx-auto relative overflow-hidden rounded-[2.5rem] bg-white/95 border border-white/90 p-5 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06),inset_0_1px_2px_rgba(255,255,255,1)] mt-4 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-6 relative z-10">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 shadow-[0_8px_20px_rgba(245,158,11,0.35)] flex items-center justify-center text-white text-xl sm:text-2xl shrink-0">
          🏆
        </div>
        <div>
          <h2 className="text-base sm:text-xl font-black text-[#0F172A] tracking-wider uppercase leading-none">
            Winners Board
          </h2>
          <div className="flex gap-1 mt-1.5 opacity-40">
            {[...Array(6)].map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Prize Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full relative z-10">
        {(prizes || []).filter(p => p.enabled !== false).map((prize, idx) => {
          const isWon = prize.status === 'COMPLETED';
          const wonByMe = isWon && (prize.winnerTicket === ticket?.ticketCode || prize.winner === ticket?.playerName);
          const theme = prizeThemes[idx % prizeThemes.length];

          return (
            <div
              key={`win-${prize.id}`}
              className={`relative overflow-hidden rounded-[2rem] p-4 sm:p-5 border ${theme.border} bg-gradient-to-br ${theme.cardBg} shadow-sm transition-all duration-300 select-none ${
                isWon ? 'ring-2 ring-emerald-400/50 shadow-md' : 'opacity-70'
              }`}
            >
              {/* TOP TICK MARK BADGES FOR WINNERS BOARD: */}
              {isWon && wonByMe && (
                <div 
                  title="You won this prize!" 
                  className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 border-2 border-white shadow-[0_4px_12px_rgba(245,158,11,0.5)] flex items-center justify-center text-white z-30"
                >
                  <Check className="w-5 h-5 stroke-[3.5] drop-shadow-xs" />
                </div>
              )}

              {isWon && !wonByMe && (
                <div 
                  title={`Won by ${prize.winner || 'another player'}`} 
                  className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-gradient-to-tr from-[#10B981] to-[#059669] border-2 border-white shadow-[0_4px_12px_rgba(16,185,129,0.4)] flex items-center justify-center text-white z-30"
                >
                  <Check className="w-5 h-5 stroke-[3.5] drop-shadow-xs" />
                </div>
              )}

              {/* Bottom Decorative Wave */}
              <svg className={`absolute bottom-0 left-0 right-0 w-full h-10 ${theme.waveColor} opacity-70 pointer-events-none`} viewBox="0 0 100 30" preserveAspectRatio="none">
                <path d="M0,30 Q30,10 60,20 T100,0 L100,30 Z" fill="currentColor"/>
              </svg>

              {/* Header Row */}
              <div className="flex items-center gap-3 mb-2.5 relative z-10">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full ${theme.iconBg} shadow-md flex items-center justify-center text-white text-lg shrink-0`}>
                  🏆
                </div>
                <div>
                  <h3 className={`text-base sm:text-lg font-black ${theme.textColor} leading-none tracking-tight`}>
                    {prize.name}
                  </h3>
                  <div className="flex gap-1 mt-1 opacity-50">
                    {[...Array(7)].map((_, i) => (
                      <span key={i} className={`w-1 h-1 rounded-full ${theme.dotColor}`}></span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-col gap-1 text-xs font-bold text-[#475569] relative z-10 pl-1 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🎁</span>
                  <span className="truncate">{prize.prizeItem || 'Prize Item'}</span>
                </div>
                {prize.sponsor && (
                  <div className="flex items-center gap-2 text-[#64748B]">
                    <span className="text-sm">💛</span>
                    <span className="truncate">{prize.sponsor}</span>
                  </div>
                )}
              </div>

              {/* Winner Info Footer */}
              <div className="mt-3 pt-2 border-t border-black/5 relative z-10 flex justify-between items-center">
                {isWon ? (
                  <div className="flex flex-col w-full">
                    <span className="text-xs font-black text-[#0F172A] bg-white/95 px-3 py-1 rounded-full shadow-xs border border-slate-200/80 truncate">
                      👑 {prize.winner}
                    </span>
                    {prize.winnerTicket && (
                      <span className="text-[10px] font-mono text-[#64748B] mt-1 pl-1">
                        Ticket #{prize.winnerTicket}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-bold text-[#94A3B8] italic">
                    Waiting for Winner... ⏳
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Generate Recent Numbers Bar matching exact reference UI (Compact side-by-side fit)
  const renderRecentNumbers = () => {
    const recentSix = (drawnNumbers || []).slice(-6).reverse();

    return (
      <div className="w-full mx-auto relative overflow-hidden rounded-[2rem] sm:rounded-full bg-white/95 border border-white/90 p-2.5 sm:p-3 px-3 sm:px-4 shadow-[0_12px_30px_rgba(15,23,42,0.05),inset_0_1px_2px_rgba(255,255,255,1)] flex items-center justify-between gap-2 sm:gap-3 my-2">
        {/* Background Waves & Leaf Flourish */}
        <svg className="absolute -left-2 -bottom-2 w-14 h-14 text-emerald-500/10 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17,8C8,10 5,16 3,21C8,20 15,17 17,8Z"/>
          <path d="M12,2C6,5 4,11 3,16C7,14 11,10 12,2Z" opacity="0.6"/>
        </svg>
        <svg className="absolute -right-4 -bottom-4 w-28 h-14 text-emerald-500/10 pointer-events-none" viewBox="0 0 100 40">
          <path d="M0,40 Q40,10 80,30 T100,0 L100,40 Z" fill="currentColor"/>
        </svg>

        {/* Left Side Header */}
        <div className="flex items-center gap-2 sm:gap-2.5 relative z-10 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#00C16E] to-[#00a85e] shadow-[0_4px_12px_rgba(0,193,110,0.35)] flex items-center justify-center text-white shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.3]" />
          </div>
          <div>
            <h3 className="text-[11px] sm:text-xs font-black text-[#0F172A] tracking-wider uppercase leading-none">
              Recent Numbers
            </h3>
            <p className="text-[9.5px] sm:text-[10.5px] font-semibold text-[#64748B] mt-0.5">
              Latest 6 numbers
            </p>
          </div>
          <div className="h-6 w-[1px] bg-slate-200/80 mx-0.5 hidden sm:block shrink-0" />
        </div>

        {/* Center Numbers Row (Fits all 6 side-by-side cleanly) */}
        <div className="min-w-0 flex-1 flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 relative z-10 overflow-x-auto scrollbar-hide py-0.5 px-0.5">
          <AnimatePresence mode="popLayout">
            {recentSix.map((num, i) => (
              <motion.div
                key={`recent-num-${num}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className={
                  i === 0
                    ? "w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#00C16E] to-[#00a85e] text-white font-black text-xs sm:text-base shadow-[0_0_14px_rgba(0,193,110,0.4)] ring-2 sm:ring-4 ring-emerald-100 flex items-center justify-center shrink-0 z-10"
                    : "w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-full bg-white text-[#064E3B] font-black text-[11px] sm:text-xs shadow-[0_2px_6px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center justify-center shrink-0"
                }
              >
                {num}
              </motion.div>
            ))}
          </AnimatePresence>
          {recentSix.length === 0 && (
            <span className="text-[11px] font-semibold text-slate-400 italic">No numbers yet</span>
          )}
        </div>

        {/* Right Arrow Circle */}
        <div 
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full bg-white border border-slate-100/90 text-[#00C16E] shadow-2xs flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-50 transition-colors relative z-10"
          title="Toggle History"
        >
          <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] transition-transform duration-300 ${isHistoryExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
    );
  };

  // Generate Number Board (1-90) matching exact reference UI
  const renderNumberBoard = () => {
    const drawnCount = drawnNumbers.length;
    const pendingCount = 90 - drawnCount;

    return (
      <div className="w-full mx-auto relative overflow-hidden rounded-[2.5rem] bg-white/95 border border-white/90 p-5 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06),inset_0_1px_2px_rgba(255,255,255,1)] my-4">
        {/* Background Sparkles */}
        <span className="absolute top-6 left-6 text-pink-300/60 text-lg select-none pointer-events-none">✦</span>
        <span className="absolute top-12 left-2 text-blue-300/60 text-base select-none pointer-events-none">✦</span>
        <span className="absolute bottom-16 -left-1 text-blue-400/60 text-sm select-none pointer-events-none">●</span>
        <span className="absolute top-20 right-6 text-amber-300/60 text-base select-none pointer-events-none">✦</span>
        <span className="absolute bottom-28 right-4 text-emerald-400/60 text-lg select-none pointer-events-none">★</span>
        <span className="absolute bottom-12 right-2 text-purple-400/60 text-sm select-none pointer-events-none">●</span>

        {/* Top Header Row */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6 relative z-10">
          {/* Left Title & Icon */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-100 via-indigo-50 to-purple-50 p-1 flex items-center justify-center text-2xl sm:text-3xl shadow-xs border border-indigo-100/80 shrink-0">
              🎲
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-[#0F172A] tracking-wider uppercase leading-none">
                Number Board (1-90)
              </h2>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="h-1 w-14 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400"></div>
                <span className="text-amber-400 text-xs">✦</span>
                <span className="text-amber-300 text-[10px]">✦</span>
              </div>
            </div>
          </div>

          {/* Right Stats Cards */}
          <div className="flex items-center gap-3">
            {/* Generated Stats Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/80 border border-blue-200/80 rounded-2xl px-3.5 py-1.5 sm:px-5 sm:py-2.5 flex flex-col items-center justify-center shadow-2xs">
              <span className="text-blue-600 text-[10px] sm:text-xs font-black flex items-center gap-1">✦ Generated</span>
              <span className="text-xl sm:text-2xl font-black text-blue-600 leading-tight">{drawnCount}</span>
            </div>

            {/* Pending Stats Card */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50/80 border border-orange-200/80 rounded-2xl px-3.5 py-1.5 sm:px-5 sm:py-2.5 flex flex-col items-center justify-center shadow-2xs">
              <span className="text-orange-600 text-[10px] sm:text-xs font-black flex items-center gap-1">🕒 Pending</span>
              <span className="text-xl sm:text-2xl font-black text-orange-600 leading-tight">{pendingCount}</span>
            </div>
          </div>
        </div>

        {/* 1-90 Grid Matrix (10 Columns x 9 Rows) */}
        <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 w-full my-4 relative z-10">
          {Array.from({ length: 90 }, (_, i) => i + 1).map(num => {
            const drawn = isDrawn(num);
            return (
              <div
                key={`num-board-tile-${num}`}
                className={`flex items-center justify-center aspect-square rounded-xl sm:rounded-2xl text-xs sm:text-base font-black transition-all duration-300 select-none ${
                  drawn
                    ? "bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)] border border-blue-400/40"
                    : "bg-white text-[#334155] shadow-[0_4px_10px_rgba(0,0,0,0.05)] border border-slate-100"
                }`}
              >
                {num}
              </div>
            );
          })}
        </div>

        {/* Bottom Legend Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-5 relative z-10">
          {/* Card 1: Generated Legend */}
          <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] shadow-xs flex items-center justify-center text-white shrink-0">
              <span className="w-3 h-3 rounded-md bg-white/30"></span>
            </div>
            <div>
              <div className="font-black text-[#1E3A8A] text-xs sm:text-sm">Generated ({drawnCount})</div>
              <div className="text-[10.5px] font-semibold text-[#64748B]">Blue numbers are ready! 🎉</div>
            </div>
          </div>

          {/* Card 2: Pending Legend */}
          <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-700 shrink-0">
              <span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-200"></span>
            </div>
            <div>
              <div className="font-black text-[#1E293B] text-xs sm:text-sm">Pending ({pendingCount})</div>
              <div className="text-[10.5px] font-semibold text-[#64748B]">White numbers are pending! ⏳</div>
            </div>
          </div>

          {/* Card 3: Encouragement Banner */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-200/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 flex items-center justify-center text-xl shrink-0">
              🏆
            </div>
            <div>
              <div className="font-black text-[#064E3B] text-xs sm:text-sm">Almost there!</div>
              <div className="text-[10.5px] font-semibold text-[#047857]">{pendingCount} numbers are still pending. Keep going! 💪</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative pb-24 md:pb-8" onClick={unlockAudio}>
      
      {/* Background Animated Gradient Orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>

      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 left-4 md:left-auto md:right-8 md:top-8 bg-white/90 backdrop-blur-xl border border-white/60 text-[#1B2430] p-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] z-[100] flex items-center gap-3"
          >
            <span className="text-xl">🎉</span>
            <span className="font-semibold text-sm">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {syncStatus !== 'SYNCED' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 bg-white/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-[#00C16E] border-t-transparent rounded-full mb-6 shadow-[0_0_20px_rgba(0,193,110,0.3)]"
            />
            <p className="text-xl font-bold text-[#1B2430]">Synchronizing Game Board...</p>
            <p className="text-sm font-semibold text-brand-text-muted mt-2">Connecting to Live Session</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== DESKTOP VIEW ===================== */}
      <div className="hidden md:block relative z-10">
        
        {/* Glass Header */}
        <div className="sticky top-4 mx-8 z-50 h-16 glass-nav rounded-[2rem] flex justify-between items-center px-6">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-[#1B2430] text-lg tracking-tight">Housie</span>
            <span className="px-3 py-1 rounded-full bg-[#4F8EF7]/10 border border-[#4F8EF7]/20 text-[#4F8EF7] text-xs font-bold">
              #{ticket.ticketCode}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-[#00C16E]/10 border border-[#00C16E]/20 px-3 py-1.5 rounded-full items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00C16E] animate-pulse shadow-[0_0_8px_#00C16E]"></span>
              <span className="text-xs font-bold text-[#00a85e]">{onlineCount} Online</span>
            </div>
            <motion.button 
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={toggleVoice} 
              className="w-10 h-10 flex items-center justify-center bg-white/50 rounded-full text-xl shadow-sm border border-white/60 text-[#1B2430]"
            >
              {isVoiceEnabled ? '🔊' : '🔈'}
            </motion.button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full px-8 pt-8 grid grid-cols-12 gap-6">
          
          {/* Left Column - Hero & Ticket */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            
            {/* Hero Number */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-8 flex flex-col items-center justify-center relative overflow-hidden"
            >
              <div className="relative z-10">
                <RollingDice finalNumber={currentNumber} isLive={gameState === "LIVE"} size="desktop" logos={logos} />
              </div>
              <p className="mt-6 text-[#6B7280] font-bold text-sm tracking-widest uppercase">
                {currentNumber ? `Number ${currentNumber}` : 'Waiting...'}
              </p>
              
              <div className="mt-6">
                <GameStatusTimer gameState={gameState} countdown={nextDrawCountdown} pauseCountdown={pauseCountdown} isMobile={false} />
              </div>
            </motion.div>

            {renderTicket(true)}
          </div>

          {/* Right Column - Prizes & Boards */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {renderRecentNumbers()}
            {renderPrizes()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Draws */}
              <div className="glass-panel p-6">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-sm font-bold text-[#6B7280] uppercase tracking-widest">Recent Draws</h2>
                  <span className="text-xs font-bold text-[#4F8EF7] bg-[#4F8EF7]/10 px-3 py-1 rounded-full border border-[#4F8EF7]/20">
                    {drawnNumbers.length} / 90
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5 mb-6">
                  <AnimatePresence>
                    {drawnNumbers.slice(-10).map(num => (
                      <motion.div 
                        key={`rec-${num}`} 
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-[#4F8EF7] to-[#3B7CE6] shadow-[0_10px_20px_rgba(79,142,247,0.3)]"
                      >
                        {num}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {drawnNumbers.length === 0 && <span className="text-sm text-[#9CA3AF] italic">No numbers yet.</span>}
                </div>
                
                <button onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} className="w-full py-3 text-sm font-bold text-[#4F8EF7] bg-white/50 border border-white/60 rounded-2xl hover:bg-white/80 transition-colors shadow-sm">
                  {isHistoryExpanded ? 'Collapse Full History' : 'View Full History'}
                </button>
                
                <AnimatePresence>
                  {isHistoryExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mt-4 p-4 bg-white/40 rounded-2xl border border-white/50 max-h-48 overflow-y-auto grid grid-cols-8 gap-2 shadow-inner"
                    >
                      {drawnNumbers.map(num => (
                        <div key={`hist-${num}`} className="flex items-center justify-center aspect-square rounded-xl text-xs font-bold bg-white text-[#1B2430] shadow-sm">
                          {num}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            {renderNumberBoard()}
            </div>

            {renderWinnersBoard()}
          </div>
        </div>
      </div>

      {/* ===================== MOBILE VIEW ===================== */}
      <div className="md:hidden flex flex-col w-full relative z-10 pb-28">
        
        {/* Mobile Sticky Glass Header */}
        <div className="sticky top-0 z-50 glass-nav px-5 py-4 flex justify-between items-center w-full rounded-b-3xl">
          <div className="flex items-center gap-3">
            <span className="font-black text-[#1B2430] text-xl tracking-tight">Housie</span>
            <span className="px-2.5 py-1 rounded-full bg-[#4F8EF7]/10 text-[#4F8EF7] text-[10px] font-bold">
              #{ticket.ticketCode}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#00C16E]/10 px-3 py-1.5 rounded-full items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00C16E] shadow-[0_0_8px_#00C16E] animate-pulse"></span>
              <span className="text-[11px] font-bold text-[#00a85e]">{onlineCount}</span>
            </div>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={toggleVoice} 
              className="w-9 h-9 flex items-center justify-center bg-white border border-white/60 shadow-sm rounded-full text-lg text-[#1B2430]"
            >
              {isVoiceEnabled ? '🔊' : '🔈'}
            </motion.button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="w-full px-4 pt-6">
          
          {/* TAB 1: GAME */}
          <div className={`flex flex-col gap-6 ${activeTab === 'game' ? 'block' : 'hidden'}`}>
            
            {/* Mobile Hero: Current Number */}
            <div className="flex flex-col items-center justify-center relative">
              <div className="relative z-10">
                <RollingDice finalNumber={currentNumber} isLive={gameState === "LIVE"} size="mobile" logos={logos} />
              </div>
              
              <div className="mt-6">
                <GameStatusTimer gameState={gameState} countdown={nextDrawCountdown} pauseCountdown={pauseCountdown} isMobile={true} />
              </div>
            </div>

            {/* Mobile Recent Chips */}
            {renderRecentNumbers()}

            {renderTicket(false)}
            {renderPrizes()}
          </div>

          {/* TAB 2: LEADERBOARD */}
          <div className={`flex flex-col gap-6 ${activeTab === 'leaderboard' ? 'block' : 'hidden'}`}>
            {renderWinnersBoard()}
          </div>

          {/* TAB 3: HISTORY */}
          <div className={`flex flex-col gap-6 ${activeTab === 'history' ? 'block' : 'hidden'}`}>
            {renderNumberBoard()}
          </div>
        </div>

        {/* Mobile Sticky Bottom Nav (Glass Pill) */}
        <div className="fixed bottom-6 mb-[env(safe-area-inset-bottom,0px)] left-6 right-6 h-16 glass-nav rounded-full flex justify-between items-center px-2 z-50">
          <button 
            onClick={() => setActiveTab('game')} 
            className="relative flex flex-col items-center justify-center w-1/3 h-full z-10"
          >
            {activeTab === 'game' && (
              <motion.div layoutId="nav-pill" className="absolute inset-1 bg-[#4F8EF7]/10 rounded-full border border-[#4F8EF7]/20 z-0" />
            )}
            <span className={`text-xl mb-0.5 z-10 transition-transform ${activeTab === 'game' ? 'scale-110' : 'grayscale opacity-50'}`}>🎟️</span>
            <span className={`text-[10px] font-bold z-10 ${activeTab === 'game' ? 'text-[#4F8EF7]' : 'text-[#9CA3AF]'}`}>Game</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('leaderboard')} 
            className="relative flex flex-col items-center justify-center w-1/3 h-full z-10"
          >
            {activeTab === 'leaderboard' && (
              <motion.div layoutId="nav-pill" className="absolute inset-1 bg-[#4F8EF7]/10 rounded-full border border-[#4F8EF7]/20 z-0" />
            )}
            <span className={`text-xl mb-0.5 z-10 transition-transform ${activeTab === 'leaderboard' ? 'scale-110' : 'grayscale opacity-50'}`}>🏆</span>
            <span className={`text-[10px] font-bold z-10 ${activeTab === 'leaderboard' ? 'text-[#4F8EF7]' : 'text-[#9CA3AF]'}`}>Leaderboard</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')} 
            className="relative flex flex-col items-center justify-center w-1/3 h-full z-10"
          >
             {activeTab === 'history' && (
              <motion.div layoutId="nav-pill" className="absolute inset-1 bg-[#4F8EF7]/10 rounded-full border border-[#4F8EF7]/20 z-0" />
            )}
            <span className={`text-xl mb-0.5 z-10 transition-transform ${activeTab === 'history' ? 'scale-110' : 'grayscale opacity-50'}`}>🔢</span>
            <span className={`text-[10px] font-bold z-10 ${activeTab === 'history' ? 'text-[#4F8EF7]' : 'text-[#9CA3AF]'}`}>Board</span>
          </button>
        </div>
      </div>

      <WinnerPopup
        winner={activeWinner}
        countdown={pauseCountdown}
        onClose={handlePopupClose}
        onBackToGame={handleBackToGame}
        instanceId={popupInstanceId}
        isTimerLagging={isTimerLagging}
      />
    </div>
  );
};

export default Game;
