import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';

let socket;

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, ticket } = useGameStore();
  const { isVoiceEnabled, toggleVoice, announceNumber } = useSpeech();

  const announceNumberRef = useRef(announceNumber);
  useEffect(() => {
    announceNumberRef.current = announceNumber;
  }, [announceNumber]);

  const [gameState, setGameState] = useState(session?.gameStatus || 'WAITING');
  const [currentNumber, setCurrentNumber] = useState(session?.currentNumber || null);
  const [drawnNumbers, setDrawnNumbers] = useState(session?.drawnNumbers || []);
  const [markedNumbers, setMarkedNumbers] = useState([]);
  const [prizes, setPrizes] = useState(session?.prizes || []);
  const [toastMsg, setToastMsg] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalJoined, setTotalJoined] = useState(session?.totalPlayers || 0);

  useEffect(() => {
    if (!session || !ticket || (session.id !== sessionId && session._id !== sessionId)) {
      navigate('/');
      return;
    }

    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    socket.emit('join_game', { sessionId, ticketCode: ticket.ticketCode, role: 'player' });

    socket.on('game_started', (data) => setGameState(data.status));
    socket.on('game_paused', (data) => setGameState(data.status));
    socket.on('game_resumed', (data) => setGameState(data.status));
    socket.on('game_ended', (data) => setGameState(data.status));
    socket.on('game_finished', (data) => setGameState(data.status || 'COMPLETED'));
    
    socket.on('number_drawn', (data) => {
      setCurrentNumber(data.number);
      setDrawnNumbers(data.history);
      announceNumberRef.current(data.number);
    });

    socket.on('game_sync', (data) => {
      setGameState(data.status);
      setCurrentNumber(data.currentNumber);
      setDrawnNumbers(data.drawnNumbers);
      if (data.prizes) setPrizes(data.prizes);
      if (data.markedNumbers) setMarkedNumbers(data.markedNumbers);
    });

    socket.on('winner_announced', (data) => {
      if (data.prizes) setPrizes(data.prizes);
      setToastMsg(`🎉 Ticket ${data.ticketCode} won ${data.prizeName}!`);
      setTimeout(() => setToastMsg(''), 5000);
    });

    socket.on('player_count_update', (data) => {
        if (data.onlineCount !== undefined) setOnlineCount(data.onlineCount);
        if (data.totalPlayers !== undefined) setTotalJoined(data.totalPlayers);
    });

    socket.on('claim_rejected', (data) => {
      setToastMsg(`❌ Claim Rejected: ${data.message}`);
      setTimeout(() => setToastMsg(''), 4000);
    });

    socket.on('number_marked', (data) => {
        setMarkedNumbers(prev => prev.includes(data.number) ? prev : [...prev, data.number]);
    });

    return () => socket.disconnect();
  }, [sessionId, session, ticket, navigate]);

  if (!session || !ticket) return null;

  const isDrawn = (num) => drawnNumbers.includes(num);
  const isMarked = (num) => markedNumbers.includes(num);

  const claimPrize = (prizeId) => {
    if (gameState !== 'LIVE') return;
    socket.emit('claim_prize', { sessionId, ticketCode: ticket.ticketCode, prizeId });
  };

  const handleMarkNumber = (num) => {
      if (gameState !== 'LIVE') return;
      if (num === 0) return;
      if (isMarked(num)) return; // Cannot unmark
      if (!isDrawn(num)) return; // Cannot mark undrawn
      
      // Optimistic update
      setMarkedNumbers(prev => [...prev, num]);
      
      // Send to server
      socket.emit('mark_number', { sessionId, ticketCode: ticket.ticketCode, number: num });
  };

  // Removed hardcoded prizes array

  return (
    <div className="min-h-screen bg-slate-900 p-8 flex flex-col items-center">
      {toastMsg && (
        <div className="fixed top-8 right-8 bg-slate-800 border-l-4 border-emerald-500 text-white p-4 rounded shadow-2xl z-50 animate-bounce">
          {toastMsg}
        </div>
      )}

      <div className="flex justify-between items-start w-full max-w-6xl mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400 mb-1">Welcome {ticket.playerName ? ticket.playerName : ''}</h1>
          <p className="text-slate-300 font-semibold mb-1">Session: {session.sessionName}</p>
          <p className="text-slate-400 font-mono text-sm mb-3">Ticket Code: {ticket.ticketCode}</p>
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 inline-block">
            <span className="text-slate-400 text-sm block uppercase tracking-wider mb-1">Players Joined</span>
            <span className="text-xl font-bold text-emerald-400">{onlineCount} <span className="text-slate-500 text-base">/ {totalJoined}</span></span>
          </div>
        </div>
        <button 
          onClick={toggleVoice}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all border ${isVoiceEnabled ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
        >
          {isVoiceEnabled ? '🔊 Voice ON' : '🔈 Voice OFF'}
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Game Status, Current Number & Claims */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col items-center relative overflow-hidden">
            {gameState === 'PAUSED' && <div className="absolute inset-0 bg-amber-500/20 animate-pulse pointer-events-none"></div>}
            <h2 className="text-sm text-slate-400 mb-2 font-semibold uppercase tracking-widest">Status</h2>
            {gameState === 'WAITING' && <div className="text-amber-400 font-bold animate-pulse text-lg">Waiting Room...</div>}
            {gameState === 'LIVE' && <div className="text-emerald-400 font-bold text-lg">Game Live</div>}
            {gameState === 'PAUSED' && <div className="text-amber-500 font-bold text-lg">Game Paused</div>}
            {gameState === 'COMPLETED' && <div className="text-blue-400 font-bold text-lg">Game Completed</div>}
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col items-center">
            <h2 className="text-sm text-slate-400 mb-4 font-semibold uppercase tracking-widest">Current Number</h2>
            <div className={`w-32 h-32 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-900 transition-all ${gameState === 'LIVE' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_0_30px_rgba(59,130,246,0.5)]' : 'bg-slate-700'}`}>
              <span className="text-6xl font-black text-white shadow-sm">
                {currentNumber || '-'}
              </span>
            </div>
          </div>

          {/* Claim Buttons */}
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 relative">
            {gameState === 'PAUSED' && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center rounded-2xl">
                    <span className="text-amber-400 font-bold text-xl mb-2 animate-bounce">Winner Announced!</span>
                    <span className="text-slate-300 text-sm">Validating claims...</span>
                </div>
            )}
            <h2 className="text-sm text-slate-400 mb-4 font-semibold uppercase tracking-widest">Prizes</h2>
            <div className="flex flex-col gap-3">
              {prizes.filter(p => p.enabled).map(prize => {
                const isWon = prize.status === 'COMPLETED';
                const isLocked = prize.status === 'LOCKED';
                const wonByMe = isWon && prize.winnerTicket === ticket.ticketCode;
                return (
                  <button 
                    key={prize.id}
                    disabled={isWon || isLocked || gameState !== 'LIVE'}
                    onClick={() => claimPrize(prize.id)}
                    className={`
                      w-full py-3 px-4 rounded-xl font-bold flex justify-between items-center transition-all
                      ${isWon 
                        ? (wonByMe ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-700 text-slate-500 line-through') 
                        : (isLocked ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                        : (gameState !== 'LIVE' ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]'))}
                      disabled:cursor-not-allowed border border-transparent
                    `}
                  >
                    <span>{prize.name}</span>
                    {isWon && <span className="text-xs font-mono">{prize.winnerTicket}</span>}
                    {isLocked && <span className="text-xs font-mono uppercase">Locked 🔒</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Center/Right Column: Ticket & History */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700 overflow-hidden relative">
            <h2 className="text-2xl text-white mb-6 font-bold flex justify-between">
              <span>Your Tambola Ticket</span>
              <span className="text-emerald-400"># {ticket.ticketCode}</span>
            </h2>
            
            <div className="grid grid-cols-9 gap-1 bg-slate-900 p-2 rounded-xl border border-slate-700">
              {ticket.ticketMatrix.map((row, rIndex) => (
                row.map((num, cIndex) => {
                  const marked = num !== 0 && isMarked(num);
                  const canMark = num !== 0 && isDrawn(num) && !marked && gameState === 'LIVE';
                  
                  return (
                    <div 
                      key={`r${rIndex}-c${cIndex}`} 
                      onClick={() => handleMarkNumber(num)}
                      className={`
                        aspect-square flex items-center justify-center text-xl font-bold rounded-lg border transition-all duration-300 relative
                        ${num === 0 ? 'bg-slate-900/50 border-transparent' : 'bg-slate-700 border-slate-800 shadow-inner'}
                        ${marked ? 'text-slate-400' : 'text-white'}
                        ${canMark ? 'cursor-pointer hover:bg-slate-600 hover:border-slate-500' : ''}
                      `}
                    >
                      {num === 0 ? '' : num}
                      
                      {/* Strike-through visualization for marked numbers */}
                      {marked && (
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-[120%] h-1 bg-red-500 rotate-[-45deg] rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                         </div>
                      )}
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
            <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl text-slate-300 font-semibold uppercase tracking-widest">Draw History</h2>
                <div className="text-slate-400 text-sm font-bold">
                    Drawn: <span className="text-white">{drawnNumbers.length}</span> / 90
                </div>
            </div>
            <div className="grid grid-cols-10 gap-2 sm:gap-3">
              {Array.from({length: 90}, (_, i) => i + 1).map(num => (
                <div 
                  key={num}
                  className={`
                    flex items-center justify-center p-2 rounded text-sm sm:text-base font-bold transition-all duration-500
                    ${isDrawn(num) ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.8)] border border-blue-400' : 'bg-slate-900 text-slate-600 border border-slate-800'}
                  `}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <div className="w-full max-w-6xl mt-12 mb-8">
        <h2 className="text-2xl font-bold text-slate-300 mb-6 flex items-center gap-2">🏆 Winners Leaderboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {prizes.filter(p => p.enabled).map(prize => {
             const isWon = prize.status === 'COMPLETED';
             const name = prize.winner || '';
             const code = prize.winnerTicket || '';
             return (
               <div key={prize.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                 <span className="text-emerald-400 font-bold block mb-2">{prize.name}</span>
                 {isWon ? (
                    <div className="text-sm text-slate-300">
                      <p>Winner: <strong className="text-white text-base">{name}</strong></p>
                      <p className="text-slate-400 text-xs mt-1">Ticket: {code}</p>
                    </div>
                 ) : (
                    <p className="text-slate-500 italic text-sm">{prize.status === 'LOCKED' ? 'Locked 🔒' : 'Waiting...'}</p>
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
