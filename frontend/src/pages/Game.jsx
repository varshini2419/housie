import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import WinnerPopup from '../components/WinnerPopup';
import GameStatusTimer from '../components/GameStatusTimer';
import { Check } from 'lucide-react';

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
  const [nextDrawCountdown, setNextDrawCountdown] = useState(5);
  const [pauseCountdown, setPauseCountdown] = useState(0);

  const [activeTab, setActiveTab] = useState('game'); // 'game', 'leaderboard', 'history'
  const [isBoardExpanded, setIsBoardExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Unified popup pipeline (prize-independent): claim_result | pause tick → activeWinner → WinnerPopup
  const [activeWinner, setActiveWinner] = useState(null);
  const [popupInstanceId, setPopupInstanceId] = useState(0);
  const activeWinnerRef = useRef(null);
  const pendingWinnersRef = useRef([]);
  const localHiddenKeyRef = useRef(null); // Back to Game / ✕ — local only for that winner key
  const closeTimerRef = useRef(null);
  const armedByPositiveTickRef = useRef(false);
  const showWinnerRef = useRef(null);
  const hidePopupRef = useRef(null);

  const { isVoiceEnabled, toggleVoice, announceNumber, announceWinner, unlockAudio } = useSpeech();

  const makeWinnerKey = (w) => {
    if (!w) return null;
    const id = w.prizeId || w.prizeName;
    if (!id || !w.winnerTicket) return null;
    return `${id}-${w.winnerTicket}-${w.prizeName || ''}`;
  };

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const promotePending = useCallback(() => {
    const next = pendingWinnersRef.current.shift();
    if (next) {
      // showWinner clears local hide only when the next winner key differs
      setTimeout(() => showWinnerRef.current?.(next, 10, 'queue'), 0);
    }
  }, []);

  const hidePopup = useCallback((opts = {}) => {
    const { localOnly = false } = opts;
    const current = activeWinnerRef.current;
    if (!current) {
      promotePending();
      return;
    }
    if (localOnly) {
      localHiddenKeyRef.current = makeWinnerKey(current);
    } else {
      localHiddenKeyRef.current = null;
    }
    clearCloseTimer();
    armedByPositiveTickRef.current = false;
    activeWinnerRef.current = null;
    setActiveWinner(null);
    console.log('[POPUP] popup closed', makeWinnerKey(current), localOnly ? '(local)' : '');
    promotePending();
  }, [clearCloseTimer, promotePending]);

  /**
   * Single entry for showing a winner — used by claim_result, pause ticks, and queue flush.
   * No prize-type branching. Local hide only suppresses the same winner key.
   */
  const showWinner = useCallback((winner, countdown = 10, source = 'claim') => {
    if (!winner) return;
    const key = makeWinnerKey(winner);
    if (!key) {
      console.warn('[POPUP] invalid winner payload', winner);
      return;
    }

    if (localHiddenKeyRef.current === key) {
      console.log('[POPUP] suppressed local hide', key, source);
      return;
    }
    if (localHiddenKeyRef.current && localHiddenKeyRef.current !== key) {
      localHiddenKeyRef.current = null;
    }

    pendingWinnersRef.current = pendingWinnersRef.current.filter((w) => makeWinnerKey(w) !== key);

    const prevKey = makeWinnerKey(activeWinnerRef.current);
    if (prevKey !== key) {
      setPopupInstanceId((id) => id + 1);
      activeWinnerRef.current = winner;
      setActiveWinner(winner);
      armedByPositiveTickRef.current = false;
      console.log('[POPUP] activeWinner updated', winner.prizeName, source);

      const isPlayer = !winner.winnerName || winner.winnerName.trim() === '' || winner.winnerName === 'Player';
      announceWinner(
        isPlayer
          ? `Congratulations! Ticket Number ${winner.winnerTicket} won ${winner.prizeName}.`
          : `Congratulations ${winner.winnerName}! You won ${winner.prizeName}.`
      );
    }

    const n = typeof countdown === 'number' && !Number.isNaN(countdown) ? countdown : 10;
    setPauseCountdown(n);

    if (source === 'tick' && n > 0) {
      armedByPositiveTickRef.current = true;
    }

    clearCloseTimer();
    if (source === 'tick' && n <= 0) {
      if (armedByPositiveTickRef.current) {
        hidePopup({ localOnly: false });
      }
      return;
    }

    // Soft local fallback only — does not depend on receiving tick 10 first
    const wait = (n > 0 ? n : 10) + 0.75;
    closeTimerRef.current = setTimeout(() => {
      console.log('[POPUP] auto-close fallback', wait);
      hidePopup({ localOnly: false });
    }, wait * 1000);
  }, [announceWinner, clearCloseTimer, hidePopup]);

  showWinnerRef.current = showWinner;
  hidePopupRef.current = hidePopup;

  const enqueueOrShowWinner = useCallback((winnerData) => {
    const key = makeWinnerKey(winnerData);
    if (!key) return;

    if (localHiddenKeyRef.current === key) return;
    if (localHiddenKeyRef.current && localHiddenKeyRef.current !== key) {
      localHiddenKeyRef.current = null;
    }

    const activeKey = makeWinnerKey(activeWinnerRef.current);
    if (activeKey === key) {
      // Already showing — refresh countdown default if needed
      return;
    }

    if (!activeWinnerRef.current) {
      showWinnerRef.current?.(winnerData, 10, 'claim');
      return;
    }

    if (!pendingWinnersRef.current.some((w) => makeWinnerKey(w) === key)) {
      pendingWinnersRef.current.push(winnerData);
      console.log('[POPUP] winnerQueue updated', winnerData.prizeName, pendingWinnersRef.current.length);
    }
  }, []);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

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
      announceNumber(number);
    });

    socketRef.current.on('game_started', () => setGameState('LIVE'));

    socketRef.current.on('game_paused', ({ countdown, currentWinner }) => {
      setGameState('PAUSED');
      if (currentWinner && countdown > 0) {
        showWinnerRef.current?.(currentWinner, countdown, 'tick');
      } else if (countdown !== undefined) {
        setPauseCountdown(countdown);
      }
    });
    
    socketRef.current.on('pause_countdown_tick', ({ countdown, currentWinner }) => {
      console.log('[POPUP] countdown updated', countdown, currentWinner?.prizeName);
      if (countdown <= 0) {
        setPauseCountdown(0);
        if (armedByPositiveTickRef.current) {
          hidePopupRef.current?.({ localOnly: false });
        }
        return;
      }
      if (currentWinner) {
        showWinnerRef.current?.(currentWinner, countdown, 'tick');
      } else {
        armedByPositiveTickRef.current = true;
        setPauseCountdown(countdown);
      }
    });
    
    socketRef.current.on('countdown_update', ({ countdown }) => {
      setNextDrawCountdown(countdown);
    });

    socketRef.current.on('game_resumed', () => {
      console.log('[POPUP] game_resumed');
      setGameState('LIVE');
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      armedByPositiveTickRef.current = false;
      localHiddenKeyRef.current = null;
      activeWinnerRef.current = null;
      setActiveWinner(null);
      setPauseCountdown(0);
      const next = pendingWinnersRef.current.shift();
      if (next) {
        setTimeout(() => showWinnerRef.current?.(next, 10, 'queue'), 0);
      }
    });
    socketRef.current.on('game_ended', () => setGameState('COMPLETED'));

    socketRef.current.on('game_deleted', () => {
      alert('The session was deleted by the host.');
      navigate('/');
    });

    // Same path for EVERY prize type
    socketRef.current.on('claim_result', ({ success, message, prizeId, prizeName, winnerTicket, winnerName, prizeItem }) => {
      console.log('[POPUP] claim_result received', { success, prizeId, prizeName, winnerTicket });
      setToastMsg(message);
      setTimeout(() => setToastMsg(null), 4000);

      if (success) {
        setPrizes(prevPrizes => prevPrizes.map(p => {
          if (p.id === prizeId || p.name === prizeName) {
            return { ...p, status: 'COMPLETED', winnerTicket, winner: winnerName, prizeItem: prizeItem || p.prizeItem };
          }
          return p;
        }));
        enqueueOrShowWinner({
          prizeId: prizeId || prizeName,
          prizeName,
          winnerTicket,
          winnerName,
          prizeItem
        });
      }
    });

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [sessionId, ticket?.ticketCode, navigate, enqueueOrShowWinner]);

  const isDrawn = (num) => drawnNumbers.includes(num);
  const isMarked = (num) => markedNumbers.includes(num);

  const claimPrize = (prizeId) => {
    if (gameState !== 'LIVE') return;
    socketRef.current.emit('claim_prize', { sessionId, ticketCode: ticket.ticketCode, prizeId });
  };

  // Local only — does not resume pause / no socket emit
  const handleBackToGame = useCallback(() => {
    hidePopup({ localOnly: true });
    setActiveTab('game');
  }, [hidePopup]);

  const handlePopupClose = handleBackToGame;

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

  // Generate Ticket Grid
  const renderTicket = (isDesktop = true) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`glass-panel p-5 sm:p-6 w-full mx-auto relative overflow-hidden ${gameState === 'LIVE' ? 'shadow-[0_20px_60px_rgba(0,193,110,0.15)] border-[#00C16E]/30' : ''}`}
    >
      <div className="flex justify-between items-center mb-5 relative z-10">
         <h2 className="text-sm font-bold text-[#6B7280] uppercase tracking-widest">Your Ticket</h2>
         <span className="text-[10px] font-bold text-[#00a85e] bg-[#00C16E]/10 px-3 py-1 rounded-full border border-[#00C16E]/20">
           ACTIVE
         </span>
      </div>
      
      <div className="grid grid-cols-9 gap-1.5 sm:gap-2 w-full relative z-10">
        {(ticket?.ticketMatrix || []).map((row, rIndex) => (
          row.map((num, cIndex) => {
            const marked = num !== 0 && isMarked(num);
            const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';
            
            return (
              <motion.div 
                key={`${isDesktop ? 'd' : 'm'}-r${rIndex}-c${cIndex}`} 
                onClick={() => handleMarkNumber(num)}
                whileHover={canMark ? { scale: 1.1, y: -2 } : {}}
                whileTap={canMark ? { scale: 0.95 } : {}}
                className={`aspect-square flex items-center justify-center text-sm sm:text-xl font-bold rounded-xl sm:rounded-2xl relative select-none transition-all duration-300
                  ${num === 0 ? 'bg-transparent' : 'bg-white/80 border border-white/60 shadow-sm text-[#1B2430]'}
                  ${marked ? 'bg-gradient-to-br from-[#00C16E] to-[#00a85e] text-white border-none shadow-[0_4px_15px_rgba(0,193,110,0.4)] z-10' : ''}
                  ${canMark ? 'cursor-pointer ring-2 ring-[#4F8EF7]/50 shadow-[0_0_15px_rgba(79,142,247,0.3)]' : ''}
                `}
              >
                {num === 0 ? '' : num}
                {marked && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm text-[#00C16E]"
                  >
                    <Check size={12} strokeWidth={4} />
                  </motion.div>
                )}
              </motion.div>
            );
          })
        ))}
      </div>
    </motion.div>
  );

  // Generate Prizes
  const renderPrizes = () => (
    <div className="w-full mt-4 sm:mt-0 glass-panel p-4 sm:p-5">
      <h2 className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-3">Claim Prizes</h2>
      <div className="flex flex-wrap gap-2 w-full">
        {(prizes || []).filter(p => p.enabled !== false).map(prize => {
          const isWon = prize.status === 'COMPLETED';
          const isLocked = prize.status === 'LOCKED';
          const wonByMe = isWon && prize.winnerTicket === ticket.ticketCode;
          
          let btnClass = "claim-btn-missed";
          if (isWon && wonByMe) btnClass = "claim-btn-won";
          else if (!isWon && !isLocked && gameState === 'LIVE') btnClass = "claim-btn-active";
          else if (isLocked || (!isWon && gameState !== 'LIVE')) btnClass = "claim-btn-locked";

          return (
            <motion.button 
              key={prize.id}
              disabled={isWon || isLocked || gameState !== 'LIVE'}
              onClick={() => claimPrize(prize.id)}
              whileTap={(isWon || isLocked || gameState !== 'LIVE') ? {} : { scale: 0.95 }}
              className={`flex-grow sm:flex-grow-0 sm:min-w-[120px] p-2.5 rounded-2xl flex flex-col items-center justify-center text-center whitespace-normal select-none touch-manipulation ${btnClass}`}
            >
              <span className="text-xs font-bold">🏆 {prize.name}</span>
              <span className={`text-[10px] font-medium leading-tight mt-0.5 break-words ${isWon && wonByMe ? 'text-white/90' : (!isWon && !isLocked && gameState === 'LIVE' ? 'text-white/90' : 'text-[#6B7280]')}`}>
                🎁 {prize.prizeItem || 'Prize to be announced'}
              </span>
              {isWon && <span className="text-[9px] font-black uppercase tracking-wider mt-0.5 opacity-80">{prize.winner}</span>}
              {!isWon && isLocked && <span className="text-[9px] uppercase opacity-60 mt-0.5 font-bold">Locked 🔒</span>}
            </motion.button>
          )
        })}
      </div>
    </div>
  );

  // Generate Winners Board
  const renderWinnersBoard = () => (
    <div className="w-full mt-4 glass-panel p-5 sm:p-6 mb-6">
      <h2 className="text-sm font-bold text-[#6B7280] uppercase tracking-widest mb-5 flex items-center gap-2">
        🏆 Winners Board
      </h2>
      <div className="flex flex-col gap-4">
        {prizes.filter(p => p.enabled).map(prize => {
          const isWon = prize.status === 'COMPLETED';
          return (
            <div key={`win-${prize.id}`} className={`flex flex-col p-5 rounded-3xl bg-white/50 border transition-all shadow-sm ${isWon ? 'border-[#00C16E]/30 bg-[#00C16E]/5' : 'border-white/60'}`}>
              <span className="text-sm font-bold text-[#1B2430] mb-3">🏆 {prize.name}</span>
              
              {prize.prizeItem && (
                <div className="mb-4 flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">🎁 Prize</span>
                  <span className="text-sm font-semibold text-[#6B7280]">{prize.prizeItem}</span>
                </div>
              )}

              {isWon ? (
                <div className="flex flex-col pt-3 border-t border-[#1B2430]/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-0.5">Winner</span>
                  <span className="text-sm font-extrabold text-[#00a85e]">{prize.winner}</span>
                  {prize.winnerTicket && <span className="text-[10px] font-mono text-[#9CA3AF] mt-1">Ticket #{prize.winnerTicket}</span>}
                </div>
              ) : (
                <div className="pt-3 border-t border-[#1B2430]/5">
                  <span className="text-xs font-semibold text-[#9CA3AF] italic">Waiting...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

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

      {/* ===================== DESKTOP VIEW ===================== */}
      <div className="hidden md:block relative z-10">
        
        {/* Glass Header */}
        <div className="sticky top-4 mx-8 z-50 h-16 glass-nav rounded-[2rem] flex justify-between items-center px-6">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-[#1B2430] text-lg tracking-tight">Tambola</span>
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
                <AnimatePresence mode="popLayout">
                  <motion.div 
                    key={currentNumber || 'wait'}
                    initial={{ scale: 0.5, opacity: 0, rotateX: 90 }}
                    animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                    exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className={`w-44 h-44 rounded-full flex items-center justify-center bg-white/90 border-4 border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] relative
                      ${gameState === "LIVE" ? "shadow-[0_0_60px_rgba(79,142,247,0.3)] border-[#4F8EF7]/50" : ""}`}
                  >
                    <span className="text-[7rem] font-black text-[#1B2430] tracking-tighter leading-none mt-2">
                      {currentNumber || '-'}
                    </span>
                  </motion.div>
                </AnimatePresence>
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

              {/* Number Board */}
              <div className="glass-panel p-6 flex flex-col">
                 <div className="flex justify-between items-center mb-5">
                  <h2 className="text-sm font-bold text-[#6B7280] uppercase tracking-widest">Number Board</h2>
                  <button onClick={() => setIsBoardExpanded(!isBoardExpanded)} className="text-xs font-bold text-[#4F8EF7] bg-[#4F8EF7]/10 px-3 py-1 rounded-full">
                    {isBoardExpanded ? 'Hide' : 'Expand'}
                  </button>
                </div>
                <AnimatePresence>
                  {isBoardExpanded && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="grid grid-cols-10 gap-1.5"
                    >
                      {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                        <div 
                          key={`board-${num}`} 
                          className={`flex items-center justify-center aspect-square rounded-lg text-xs font-bold transition-all duration-300 
                            ${isDrawn(num) ? 'bg-gradient-to-br from-[#4F8EF7] to-[#3B7CE6] text-white shadow-md scale-105' : 'bg-white/50 text-[#9CA3AF] border border-white/60'}`}
                        >
                          {num}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
            <span className="font-black text-[#1B2430] text-xl tracking-tight">Tambola</span>
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
              <div className="relative">
                <AnimatePresence mode="popLayout">
                  <motion.div 
                    key={currentNumber || 'wait'}
                    initial={{ scale: 0.5, opacity: 0, rotateY: 90 }}
                    animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className={`w-40 h-40 rounded-[2rem] flex items-center justify-center bg-white/90 border-4 border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.1)] relative z-10 
                      ${gameState === "LIVE" ? "shadow-[0_0_60px_rgba(79,142,247,0.3)] border-[#4F8EF7]/50" : ""}`}
                  >
                    <span className="text-[6.5rem] font-black text-[#1B2430] tracking-tighter leading-none mt-2">
                      {currentNumber || '-'}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>
              
              <div className="mt-6">
                <GameStatusTimer gameState={gameState} countdown={nextDrawCountdown} pauseCountdown={pauseCountdown} isMobile={true} />
              </div>
            </div>

            {/* Mobile Recent Chips */}
            <div className="w-full mt-2">
              <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-hide snap-x px-2">
                <AnimatePresence>
                  {drawnNumbers.slice(-15).reverse().map((num, i) => (
                    <motion.div 
                      initial={{ scale: 0, x: -20 }} animate={{ scale: 1, x: 0 }}
                      key={`mob-rec-${num}`} 
                      className={`shrink-0 snap-start flex items-center justify-center font-bold shadow-md rounded-2xl 
                        ${i === 0 ? 'w-14 h-14 text-white bg-gradient-to-br from-[#4F8EF7] to-[#3B7CE6] text-xl shadow-[0_10px_20px_rgba(79,142,247,0.3)]' : 'w-12 h-12 text-[#6B7280] bg-white/80 border border-white/60 text-base opacity-90'}`}
                    >
                      {num}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {renderTicket(false)}
            {renderPrizes()}
          </div>

          {/* TAB 2: LEADERBOARD */}
          <div className={`flex flex-col gap-6 ${activeTab === 'leaderboard' ? 'block' : 'hidden'}`}>
            {renderWinnersBoard()}
          </div>

          {/* TAB 3: HISTORY */}
          <div className={`flex flex-col gap-6 ${activeTab === 'history' ? 'block' : 'hidden'}`}>
            <div className="glass-panel p-6">
               <div className="flex justify-between items-center mb-5">
                <h2 className="text-sm font-bold text-[#6B7280] uppercase tracking-widest">Number Board (1-90)</h2>
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                  <div 
                    key={`mob-board-${num}`}
                    className={`flex items-center justify-center aspect-square rounded-[8px] text-[10px] font-bold transition-all duration-300
                      ${isDrawn(num) ? 'bg-gradient-to-br from-[#4F8EF7] to-[#3B7CE6] text-white shadow-md scale-110' : 'bg-white/50 text-[#9CA3AF] border border-white/60'}
                    `}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>
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
      />
    </div>
  );
};

export default Game;
