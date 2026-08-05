import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import useSoundEffects from '../hooks/useSoundEffects';
import GameStatusTimer from '../components/GameStatusTimer';
import WinnerPopup from '../components/WinnerPopup';
import { Check } from 'lucide-react';

const MemoizedNumberChip = React.memo(({ num, isMarked, isPending, canMark, onMark }) => {
  return (
    <motion.div 
      onClick={() => onMark(num)}
      whileHover={canMark ? { scale: 1.1, y: -2 } : {}}
      whileTap={canMark ? { scale: 0.95 } : {}}
      className={`aspect-square flex items-center justify-center text-sm sm:text-xl font-bold rounded-xl sm:rounded-2xl relative select-none transition-all duration-300
        ${num === 0 ? 'bg-transparent' : 'bg-white/80 border border-white/60 shadow-sm text-[#1B2430]'}
        ${isMarked ? 'bg-gradient-to-br from-[#00C16E] to-[#00a85e] text-white border-none shadow-[0_4px_15px_rgba(0,193,110,0.4)] z-10' : ''}
        ${isPending ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white border-none shadow-[0_4px_15px_rgba(245,158,11,0.4)] z-10 animate-pulse' : ''}
        ${canMark && !isPending ? 'cursor-pointer ring-2 ring-[#4F8EF7]/50 shadow-[0_0_15px_rgba(79,142,247,0.3)]' : ''}
      `}
    >
      {num === 0 ? '' : num}
      {isMarked && (
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
});

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, ticket } = useGameStore();
  const { playPop, playMark, playClaim, playTick } = useSoundEffects();

  const [gameState, setGameState] = useState('WAITING');
  const [syncStatus, setSyncStatus] = useState('CONNECTING');
  const [currentNumber, setCurrentNumber] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState([]);
  const [pendingMarks, setPendingMarks] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [totalJoined, setTotalJoined] = useState(1);
  const [prizes, setPrizes] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [nextDrawCountdown, setNextDrawCountdown] = useState(null);
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const [timerData, setTimerData] = useState({});
  const isSpeakingStateRef = useRef(false);

  const setSpeaking = (val) => {
    isSpeakingStateRef.current = val;
    setIsSpeakingState(val);
  };

  // UI States
  const [autoMark, setAutoMark] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBoardExpanded, setIsBoardExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('game'); // 'game', 'leaderboard', 'history'
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const autoMarkRef = useRef(autoMark);
  const ticketRef = useRef(ticket);

  useEffect(() => {
    autoMarkRef.current = autoMark;
  }, [autoMark]);

  useEffect(() => {
    ticketRef.current = ticket;
  }, [ticket]);

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
      setNextDrawCountdown(prev => {
        if (prev !== null && prev > 0) {
          const nextVal = prev - 1;
          if (nextVal <= 3 && nextVal > 0 && isVoiceEnabledRef.current) {
            playTick();
          }
          return nextVal;
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isSpeakingState, nextDrawCountdown !== null && nextDrawCountdown > 0, playTick]);

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
      if (data.markedNumbers) {
        setMarkedNumbers(prev => Array.from(new Set([...prev, ...data.markedNumbers])));
      }
    });

    socketRef.current.on('number_drawn', ({ number, drawnNumbers, tickId }) => {
      if (tickId !== undefined) {
          if (tickId < lastSyncTickRef.current) return; // Drop stale events
          lastSyncTickRef.current = tickId;
      }
      setCurrentNumber(number);
      setDrawnNumbers(drawnNumbers);
      setNextDrawCountdown(5);

      if (isVoiceEnabledRef.current) {
        playPop();
      }

      // Auto Mark feature support
      if (autoMarkRef.current && ticketRef.current?.ticketMatrix) {
        const flatNums = ticketRef.current.ticketMatrix.flat();
        if (flatNums.includes(number)) {
          setMarkedNumbers(prev => Array.from(new Set([...prev, number])));
          if (socketRef.current) {
            socketRef.current.emit('mark_number', { sessionId, ticketCode: ticketRef.current.ticketCode, number });
          }
        }
      }

      if (isVoiceEnabledRef.current) {
        setSpeaking(true);
        announceNumber(number);
      } else {
        setSpeaking(false);
      }
    });

    socketRef.current.on('countdown_update', (data) => {
      if (data && data.countdown !== null && data.countdown !== undefined) {
        setNextDrawCountdown(data.countdown);
        setTimerData(data);
      }
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

    const handleSpeechFinished = () => {
      setSpeaking(false);
    };
    window.addEventListener('speech_finished', handleSpeechFinished);

    return () => {
      window.removeEventListener('speech_finished', handleSpeechFinished);
      if (tickZeroFallbackRef.current) clearTimeout(tickZeroFallbackRef.current);
      if (tickWatchdogRef.current) clearTimeout(tickWatchdogRef.current);
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
  }, [sessionId, ticket, navigate, autoMark, markedNumbers, nextDrawCountdown]);

  const isDrawn = (num) => drawnNumbers.includes(num);
  const isMarked = (num) => markedNumbers.includes(num);

  const claimPrize = (prizeId) => {
    if (gameState !== 'LIVE' && gameState !== 'PAUSED') return;
    if (isVoiceEnabledRef.current) playClaim();
    if (socketRef.current) {
      socketRef.current.emit('claim_prize', { sessionId, ticketCode: ticket.ticketCode, prizeId });
    }
  };

  // Local only — does not resume pause / no socket emit
  const handleBackToGame = useCallback(() => {
    activeWinnerRef.current = null;
    setActiveWinner(null);
    setActiveTab('game');
  }, []);

  const handlePopupClose = handleBackToGame;

  const handleMarkNumber = (num) => {
    if (gameState !== 'LIVE' && gameState !== 'PAUSED') return;
    if (num === 0) return;
    if (!isDrawn(num)) return;
    if (isMarked(num) || pendingMarks.includes(num)) return;
    
    if (isVoiceEnabledRef.current) playMark();
    setMarkedNumbers(prev => Array.from(new Set([...prev, num])));
    setPendingMarks(prev => [...prev, num]);
    if (socketRef.current) {
      socketRef.current.emit('mark_number', { sessionId, ticketCode: ticket.ticketCode, number: num });
    }
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
              {prize.sponsor && (
                <span className={`text-[9px] font-bold leading-tight mt-0.5 break-words ${isWon && wonByMe ? 'text-white/80' : (!isWon && !isLocked && gameState === 'LIVE' ? 'text-white/80' : 'text-[#9CA3AF]')}`}>
                  🤝 {prize.sponsor}
                </span>
              )}
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
        {(prizes || []).filter(p => p.enabled).map(prize => {
          const isWon = prize.status === 'COMPLETED';
          return (
            <div key={`win-${prize.id}`} className={`flex flex-col p-5 rounded-3xl bg-white/50 border transition-all shadow-sm ${isWon ? 'border-[#00C16E]/30 bg-[#00C16E]/5' : 'border-white/60'}`}>
              <span className="text-sm font-bold text-[#1B2430] mb-3">🏆 {prize.name}</span>
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
              
              {isBoardExpanded && (
                <div className="premium-inner-board p-3.5 mt-3">
                  <div className="grid grid-cols-10 gap-1.5">
                    {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                      <div 
                        key={`mid-board-${num}`}
                        className={`flex items-center justify-center aspect-square rounded-lg text-[10px] font-bold transition-all duration-300 ${isDrawn(num) ? 'bg-blue-600 text-white font-black shadow-xs' : 'premium-number-chip'}`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ===================== MOBILE VIEW ===================== */}
        <div className="md:hidden flex flex-col gap-5 p-4 pb-28">
          <div className="bg-gradient-to-b from-white to-slate-50/80 border border-slate-200/90 rounded-3xl p-5 shadow-xl shadow-blue-900/5 flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-sm">
            <div className="flex items-center gap-2 bg-blue-50/90 border border-blue-100 px-3.5 py-1 rounded-full text-[11px] font-black tracking-widest uppercase text-blue-700 shadow-xs mb-2">
              <span className={`w-2 h-2 rounded-full ${gameState === 'LIVE' ? 'bg-emerald-500 animate-pulse' : (gameState === 'PAUSED' ? 'bg-amber-500' : 'bg-slate-400')}`}></span>
              <span>{gameState === 'LIVE' ? 'LIVE DRAW' : (gameState === 'PAUSED' ? 'GAME PAUSED' : 'CURRENT DRAW')}</span>
            </div>

            {/* Radial Progress Ring & Tambola Ball */}
            <div className="relative my-2 flex items-center justify-center">
              <svg className="w-36 h-36 transform -rotate-90 drop-shadow-md" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="ringGradientMob" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
                {/* Background Track */}
                <circle cx="60" cy="60" r="52" stroke="#E2E8F0" strokeWidth="6" fill="transparent" />
                {/* Animated Progress Arc */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="url(#ringGradientMob)"
                  strokeWidth="6"
                  strokeDasharray="326.72"
                  strokeDashoffset={326.72 * (1 - Math.max(0, Math.min(5, nextDrawCountdown !== null ? nextDrawCountdown : 5)) / 5)}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-750 ease-linear"
                />
              </svg>

              {/* Number Ball Center */}
              <div key={`mob-current-${currentNumber}`} className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-white border border-slate-100 shadow-inner flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-slate-100 to-white opacity-80"></div>
                  <span className="text-5xl font-black text-slate-800 tracking-tighter leading-none relative z-10 animate-number-enter">
                    {currentNumber || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status & Timer Footer */}
            <div className="mt-2 bg-white/90 border border-slate-200/90 px-4 py-2 rounded-2xl shadow-xs backdrop-blur-xs">
              <GameStatusTimer gameState={gameState} nextDrawCountdown={nextDrawCountdown} pauseCountdown={pauseCountdown} isSpeaking={isSpeakingState} timerData={timerData} isMobile={true} />
            </div>
          </div>

          {/* 2. TICKET CARD */}
          <div className="premium-card relative">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎟️ YOUR TICKET</span>
              </h2>
              <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-xs">Active • #{ticket.ticketCode}</span>
            </div>

            {/* Premium Tambola Ticket Board Container */}
            <div className="premium-inner-board p-3.5 sm:p-4">
              <div className="grid grid-cols-9 gap-1.5 sm:gap-2 w-full">
                {(ticket?.ticketMatrix || []).map((row, rIndex) => (
                  row.map((num, cIndex) => {
                    const marked = num !== 0 && isMarked(num);
                    const canMark = num !== 0 && isDrawn(num) && !marked && (gameState === 'LIVE' || gameState === 'PAUSED');

                    return (
                      <div 
                        key={`mob-cell-${rIndex}-${cIndex}`}
                        onClick={() => handleMarkNumber(num)}
                        className={`aspect-square flex items-center justify-center text-xs sm:text-sm font-black transition-all select-none
                          ${num === 0 
                            ? 'bg-transparent border-none' 
                            : (marked 
                              ? 'ticket-cell-marked' 
                              : 'premium-number-chip rounded-xl hover:border-blue-500')}
                          ${canMark ? 'cursor-pointer ring-2 ring-blue-500 animate-pulse' : ''}`}
                      >
                        {num === 0 ? '' : num}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Called</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200"></span> Not Called</span>
              <span className="flex items-center gap-1">⭐ Free Space</span>
            </div>
          </div>

          {/* 3. CLAIM PRIZES CARD */}
          <div className="premium-card">
            <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-3">🎁 CLAIM PRIZES</h2>
            <div className="grid grid-cols-2 gap-2.5 w-full">
              {(prizes && prizes.length > 0 ? prizes : [
                { id: 'p1', name: 'Jaldi 5', status: 'AVAILABLE', enabled: true },
                { id: 'p2', name: 'First Line', status: 'AVAILABLE', enabled: true },
                { id: 'p3', name: 'Second Line', status: 'AVAILABLE', enabled: true },
                { id: 'p4', name: 'Third Line', status: 'AVAILABLE', enabled: true },
                { id: 'p5', name: 'Full House', status: 'AVAILABLE', enabled: true }
              ]).filter(p => p.enabled !== false).map((prize, idx) => {
                const isWon = prize.status === 'COMPLETED';
                const wonByMe = isWon && prize.winnerTicket === ticket.ticketCode;
                const isFullHouse = prize.name.toLowerCase().includes('full house');

                return (
                  <button
                    key={`mob-claim-${prize.id}`}
                    disabled={isWon || (gameState !== 'LIVE' && gameState !== 'PAUSED')}
                    onClick={() => claimPrize(prize.id)}
                    className={`p-3 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 border text-center transition-all cursor-pointer min-h-[90px] ${isWon ? (wonByMe ? 'bg-emerald-500 text-white border-transparent' : 'bg-slate-50 text-slate-400 border-slate-200') : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  >
                    <span className="text-xs font-black">
                      {isFullHouse ? '👑' : '🏆'} {prize.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. NUMBER BOARD CARD (1-90) */}
          <div className="premium-card">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider">NUMBER BOARD (1-90)</h2>
              <button 
                onClick={() => setIsBoardExpanded(!isBoardExpanded)}
                className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100"
              >
                {isBoardExpanded ? 'Hide' : 'Expand'}
              </button>
            </div>

            {isBoardExpanded && (
              <div className="premium-inner-board p-2.5 mt-2">
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                    <div 
                      key={`mob-board-grid-${num}`}
                      className={`flex items-center justify-center aspect-square rounded-md text-[9px] font-bold transition-all ${isDrawn(num) ? 'bg-blue-600 text-white font-black shadow-xs' : 'premium-number-chip'}`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. WINNERS CARD */}
          <div className="premium-card">
            <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-3">🏆 WINNERS</h2>
            <div className="flex flex-col gap-2.5">
              {prizes.filter(p => p.enabled).map((prize, idx) => {
                const isWon = prize.status === 'COMPLETED';
                return (
                  <div key={`mob-win-item-${prize.id}`} className={`p-3 rounded-2xl border flex items-center justify-between ${isWon ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200/60'}`}>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <span>{isWon ? '🏆' : '🕒'}</span>
                      <span>{prize.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {isWon ? prize.winner : 'Waiting...'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. GAME INFO CARD */}
          <div className="premium-card flex flex-col gap-2.5">
            <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1">GAME INFO</h2>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="font-bold text-slate-500">🎮 Game ID</span>
                <span className="font-mono font-bold text-slate-800">TB-2451</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="font-bold text-slate-500">👥 Players</span>
                <span className="font-bold text-slate-800">{onlineCount}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="font-bold text-slate-500">🎟️ Tickets Sold</span>
                <span className="font-bold text-slate-800">{totalJoined}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold text-slate-500">☑️ Auto Mark</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${autoMark ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {autoMark ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {/* REST OF CARDS */}
          <div className="premium-card">
            <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-3">RECENT NUMBERS 🕒</h2>
            <div className="grid grid-cols-5 gap-2">
              {drawnNumbers.slice(-10).reverse().map((num, i) => (
                <div key={`mob-rec-bottom-${num}-${i}`} className={`aspect-square rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-blue-600 text-white shadow-sm' : 'premium-number-chip'}`}>
                  {num}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full">
            <div className="premium-card !p-3.5 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">🤖 Auto Mark</span>
              <button onClick={() => setAutoMark(!autoMark)} className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${autoMark ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md"></div>
              </button>
            </div>

            <div className="premium-card !p-3.5 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">🔊 Sound</span>
              <button onClick={toggleVoice} className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${isVoiceEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md"></div>
              </button>
            </div>
          </div>
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
