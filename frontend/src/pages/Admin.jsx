import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import useSpeech from '../hooks/useSpeech';
import ThemeToggle from '../components/ThemeToggle';

const Admin = () => {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [sessionName, setSessionName] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(10);
  const [startTime, setStartTime] = useState('');
  const [ticketCodeMode, setTicketCodeMode] = useState('RANDOM');
  const [startingRegisterNumber, setStartingRegisterNumber] = useState('');
  const [prizes, setPrizes] = useState([
    { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true },
    { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true },
    { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true },
    { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true },
    { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, enabled: true }
  ]);
  const [customPrizeName, setCustomPrizeName] = useState('');
  const [customPrizeType, setCustomPrizeType] = useState('Jaldi5');

  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [viewMode, setViewMode] = useState('dashboard');
  const [liveSession, setLiveSession] = useState(null);
  const [sessionTickets, setSessionTickets] = useState([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');

  const [adminStats, setAdminStats] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [nextDrawCountdown, setNextDrawCountdown] = useState(null);
  const socketRef = useRef(null);

  const { isVoiceEnabled, toggleVoice, announceNumber, unlockAudio } = useSpeech();

  useEffect(() => {
    if (token) {
      fetchActiveSessions();
    }
  }, [token]);

  useEffect(() => {
    if (viewMode === 'monitor' && liveSession) {
      socketRef.current = io(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000'));

      socketRef.current.on('connect', () => {
        socketRef.current.emit('join_game', {
          sessionId: liveSession._id,
          role: 'admin'
        });
      });

      socketRef.current.on('game_sync', (data) => {
        setAdminStats({ ...data, gameStatus: data.status });
      });

      socketRef.current.on('player_count_update', ({ onlineCount, totalPlayers }) => {
        setAdminStats(prev => prev ? { ...prev, onlineCount, totalJoined: totalPlayers } : prev);
      });

      socketRef.current.on('number_drawn', ({ number, drawnNumbers, remainingNumbers }) => {
        setAdminStats(prev => prev ? { ...prev, currentNumber: number, drawnNumbers, remainingNumbers } : prev);
        announceNumber(number);
      });

      socketRef.current.on('game_started', () => {
        setAdminStats(prev => prev ? { ...prev, gameStatus: 'LIVE' } : prev);
      });

      socketRef.current.on('game_paused', ({ countdown }) => {
        setAdminStats(prev => prev ? { ...prev, gameStatus: 'PAUSED' } : prev);
        if (countdown !== undefined) setPauseCountdown(countdown);
      });

      socketRef.current.on('pause_countdown_tick', ({ countdown }) => {
        setPauseCountdown(countdown);
      });

      socketRef.current.on('countdown_update', ({ countdown }) => {
        setNextDrawCountdown(countdown);
      });

      socketRef.current.on('game_resumed', () => {
        setAdminStats(prev => prev ? { ...prev, gameStatus: 'LIVE' } : prev);
      });

      socketRef.current.on('game_ended', () => {
        setAdminStats(prev => prev ? { ...prev, gameStatus: 'COMPLETED' } : prev);
      });

      socketRef.current.on('player_joined_status', ({ ticketCode }) => {
        setActivityFeed(prev => [{
          time: new Date(),
          message: `Player joined with ticket #${ticketCode}`
        }, ...prev.slice(0, 19)]);
      });

      socketRef.current.on('claim_result', ({ success, message, winnerTicket, winnerName, prizeId }) => {
        const msg = success 
          ? `🏆 WINNER! ${winnerName} (#${winnerTicket}) won ${prizeId}` 
          : `❌ Claim Failed: ${message}`;

        setActivityFeed(prev => [{
          time: new Date(),
          message: msg
        }, ...prev.slice(0, 19)]);
      });

      const handleSpeechFinished = (e) => {
        if (socketRef.current) {
          socketRef.current.emit('speech_finished', { sessionId: liveSession._id });
        }
      };
      window.addEventListener('speech_finished', handleSpeechFinished);

      return () => {
        window.removeEventListener('speech_finished', handleSpeechFinished);
        if (socketRef.current) socketRef.current.disconnect();
      };
    }
  }, [viewMode, liveSession?._id]);



  const fetchActiveSessions = async () => {
    setIsLoadingSessions(true);
    setSessionError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/game/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) handleLogout();
        throw new Error(data.message || 'Failed to fetch sessions');
      }
      setActiveSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSessionError(err.message || 'Error fetching sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Invalid Credentials');

      localStorage.setItem('adminToken', data.token);
      setToken(data.token);
    } catch (err) {
      console.error('Login error:', err);
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError('Cannot connect to server. The backend might be unavailable or blocked by CORS.');
      } else {
        setError(err.message || 'Login failed');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setViewMode('dashboard');
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/game/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          sessionName,
          totalPlayers: Number(totalPlayers),
          startTime,
          ticketCodeMode,
          startingRegisterNumber: ticketCodeMode === 'PATTERN' ? startingRegisterNumber : undefined,
          prizes: prizes.filter(p => p.enabled)
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to create game');

      setSuccessMsg(`Session created successfully! Session ID: ${data.sessionId}`);
      setSessionName('');
      setStartTime('');
      fetchActiveSessions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSession = async (sessionId, sessionName) => {
    if (!window.confirm(`Are you sure you want to permanently delete session "${sessionName}"? All tickets and data will be erased.`)) {
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/game/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete session');

      alert(data.message || 'Session deleted successfully');
      fetchActiveSessions();
    } catch (err) {
      alert(err.message);
    }
  };

  const viewSessionTickets = async (session) => {
    setLiveSession(session);
    setViewMode('tickets');
    setIsLoadingTickets(true);
    setTicketError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/game/${session._id}/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch tickets');
      setSessionTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setTicketError(err.message);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleAssignName = async (ticketCode, name) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000');
      const res = await fetch(`${apiUrl}/api/game/${liveSession._id}/tickets/${ticketCode}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ playerName: name })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Server returned an invalid response. The endpoint might not exist.');
      }
      
      if (!res.ok) throw new Error(data.message || 'Failed to assign name');
      setSessionTickets(prev => prev.map(t => t.ticketCode === ticketCode ? { ...t, playerName: name } : t));
    } catch (err) {
      alert(err.message);
    }
  };

  const monitorSession = (session) => {
    setLiveSession(session);
    setViewMode('monitor');
    setActivityFeed([]);
  };

  const returnToDashboard = () => {
    setViewMode('dashboard');
    setLiveSession(null);
    setAdminStats(null);
  };

  const executeControl = async (action) => {
    try {
      if (action === 'start') unlockAudio();
      
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000');
      const res = await fetch(`${apiUrl}/api/game/${liveSession._id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      let data;
      try {
        data = await res.json();
      } catch(err) {
        throw new Error('Server returned an invalid response. The endpoint might not exist.');
      }

      if (!res.ok) throw new Error(data.message || `Failed to ${action} game`);
    } catch (err) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Copied ticket code: ${text}`);
  };

  const copyAllTickets = () => {
    const list = sessionTickets.map((t, idx) => `${idx + 1}. Code: ${t.ticketCode} | Player: ${t.playerName || 'Unassigned'}`).join('\n');
    navigator.clipboard.writeText(list);
    alert('All Ticket details copied to clipboard!');
  };

  const exportCSV = () => {
    const csvRows = ['S.No,Ticket Code,Player Name,Ticket Status,Player Status'];
    sessionTickets.forEach((t, idx) => {
      csvRows.push(`${idx + 1},${t.ticketCode},"${t.playerName || ''}",Active,${t.playerStatus}`);
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Tickets_${liveSession.sessionName}.csv`);
    a.click();
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg relative overflow-hidden px-4">
        {/* Background Ambient Orbs */}
        <div className="pointer-events-none absolute -top-40 -left-40 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] mix-blend-screen dark:mix-blend-color-dodge z-0 opacity-60"></div>
        <div className="pointer-events-none absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] mix-blend-screen dark:mix-blend-color-dodge z-0 opacity-60"></div>

        <div className="absolute top-8 right-8 z-20">
          <ThemeToggle />
        </div>

        <div className="glass-panel p-8 rounded-3xl shadow-premium-lg w-full max-w-md border border-brand-border relative z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-b-full"></div>
          
          <h2 className="text-2xl mb-6 font-extrabold text-center text-brand-text tracking-tight flex items-center justify-center gap-2">
            <span>🛡️</span> Admin Portal
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3.5 rounded-2xl mb-5 text-sm font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">Username</label>
              <input 
                type="text" 
                placeholder="Admin username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full premium-input" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full premium-input" 
              />
            </div>
            <button 
              type="submit" 
              className="w-full mt-2 premium-btn-success w-full mt-2 text-lg"
            >
              Sign In to Dashboard →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto min-h-screen bg-brand-bg text-brand-text relative">
      {/* Top Header */}
      <div className="glass-panel p-6 flex justify-between items-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
          Admin Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button 
            onClick={handleLogout} 
            className="px-4 py-2 rounded-2xl border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all font-semibold text-sm cursor-pointer shadow-sm rounded-xl"
          >
            Logout 🚪
          </button>
        </div>
      </div>

      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Session Card */}
          <div className="glass-panel p-6 sm:p-8 relative">
            <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-b-full"></div>

            <h2 className="text-xl font-bold mb-6 text-brand-text flex items-center gap-2">
              <span>➕</span> Create New Session
            </h2>

            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-2xl mb-6 text-sm font-medium">{error}</div>}
            {successMsg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl mb-6 text-sm font-medium">{successMsg}</div>}
            
            <form onSubmit={handleCreateGame} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">Session Title</label>
                <input type="text" required value={sessionName} onChange={e => setSessionName(e.target.value)} className="w-full premium-input" placeholder="E.G. Friday Evening Tambola" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">Total Players</label>
                  <input type="number" min="1" max="1000" required value={totalPlayers} onChange={e => setTotalPlayers(e.target.value)} className="w-full premium-input" placeholder="10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">Start Time</label>
                  <input type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full premium-input cursor-pointer" />
                </div>
              </div>

              {/* Segmented control for mode */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider ml-1">Ticket Code Generation</label>
                <div className="grid grid-cols-2 gap-2 bg-brand-bg p-1.5 rounded-2xl border border-brand-border">
                  <button
                    type="button"
                    onClick={() => setTicketCodeMode('RANDOM')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${ticketCodeMode === 'RANDOM' ? 'bg-brand-card text-brand-emerald shadow-sm border border-brand-border' : 'text-brand-text-muted hover:text-brand-text'}`}
                  >
                    Random Codes
                  </button>
                  <button
                    type="button"
                    onClick={() => setTicketCodeMode('PATTERN')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${ticketCodeMode === 'PATTERN' ? 'bg-brand-card text-brand-emerald shadow-sm border border-brand-border' : 'text-brand-text-muted hover:text-brand-text'}`}
                  >
                    Custom Pattern
                  </button>
                </div>
              </div>

              {ticketCodeMode === 'PATTERN' && (
                <div>
                  <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">Starting Register Code</label>
                  <input type="text" required value={startingRegisterNumber} onChange={e => setStartingRegisterNumber(e.target.value)} className="w-full premium-input font-mono" placeholder="E.G. A1 OR 24B91A0701" />
                </div>
              )}

              {/* Prize Configuration */}
              <div className="space-y-3 border-t border-brand-border pt-4">
                <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider ml-1">Configured Prizes</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {prizes.map((prize, idx) => (
                    <div key={prize.id} className="flex items-center justify-between gap-2 glass-panel-secondary p-3 border border-brand-border hover:border-emerald-500/30 transition-all">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none truncate">
                        <input 
                          type="checkbox" 
                          checked={prize.enabled} 
                          onChange={(e) => {
                            const newPrizes = [...prizes];
                            newPrizes[idx].enabled = e.target.checked;
                            setPrizes(newPrizes);
                          }} 
                          className="accent-emerald-500 rounded cursor-pointer w-4 h-4" 
                        />
                        <span className="text-sm font-semibold text-brand-text-sec truncate">{prize.name}</span>
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setPrizes(prev => prev.filter(p => p.id !== prize.id))}
                        className="text-red-500 hover:text-red-600 transition-colors p-1 text-xs font-bold cursor-pointer rounded hover:bg-red-500/10"
                        title="Delete prize"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="glass-panel-secondary p-4 border border-brand-border flex flex-col sm:flex-row gap-2 mt-3">
                  <input type="text" value={customPrizeName} onChange={e => setCustomPrizeName(e.target.value)} placeholder="Custom Prize Name" className="flex-1 p-2.5 rounded-xl bg-brand-input border border-brand-input-border text-brand-text text-xs outline-none focus:ring-2 focus:ring-brand-blue" />
                  <select value={customPrizeType} onChange={e => setCustomPrizeType(e.target.value)} className="p-2.5 rounded-xl bg-brand-input border border-brand-input-border text-brand-text text-xs outline-none cursor-pointer">
                    <option value="Jaldi5">Jaldi 5</option>
                    <option value="FirstLine">First Line</option>
                    <option value="SecondLine">Second Line</option>
                    <option value="ThirdLine">Third Line</option>
                    <option value="FullHouse">Full House</option>
                  </select>
                  <button type="button" onClick={() => {
                    if(!customPrizeName.trim()) return;
                    const sameType = prizes.filter(p => p.type === customPrizeType);
                    const sequence = sameType.length > 0 ? Math.max(...sameType.map(p => p.sequence)) + 1 : 1;
                    setPrizes([...prizes, { id: 'cp' + Date.now(), name: customPrizeName, type: customPrizeType, sequence, enabled: true }]);
                    setCustomPrizeName('');
                  }} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer">Add Prize</button>
                </div>
              </div>
              
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-4 rounded-2xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer text-base">
                Create Game Session ✨
              </button>
            </form>
          </div>

          {/* All Sessions Card */}
          <div className="glass-panel p-6 sm:p-8">
            <h2 className="text-xl font-bold mb-6 text-brand-text flex items-center gap-2">
              <span>📋</span> All Sessions ({activeSessions.length})
            </h2>

            {sessionError && <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-2xl mb-6 text-sm">{sessionError}</div>}
            
            {isLoadingSessions ? (
              <p className="text-brand-text-muted text-center py-8">Loading active sessions...</p>
            ) : (
              <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                {(Array.isArray(activeSessions) ? activeSessions : []).map(session => (
                  <div key={session._id} className="p-5 bg-brand-bg rounded-2xl border-l-4 border-l-emerald-500 border-y border-r border-brand-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-extrabold text-brand-text text-base">{session.sessionName}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${session.gameStatus === 'LIVE' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : session.gameStatus === 'PAUSED' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>
                          {session.gameStatus}
                        </span>
                      </div>
                      <p className="text-xs text-brand-text-muted mb-1">Starts: <strong>{new Date(session.startTime).toLocaleString()}</strong></p>
                      <p className="text-xs text-brand-text-muted">Tickets Allocated: <strong className="text-brand-text">{session.totalPlayers}</strong></p>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => viewSessionTickets(session)} className="flex-1 sm:flex-none bg-brand-card hover:bg-brand-bg border border-brand-border text-brand-text px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm">Tickets</button>
                      <button onClick={() => monitorSession(session)} className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-md">Manage</button>
                      <button onClick={() => handleDeleteSession(session._id, session.sessionName)} className="flex-1 sm:flex-none bg-red-600/10 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))}
                {(Array.isArray(activeSessions) ? activeSessions : []).length === 0 && (
                  <div className="text-center py-12 text-brand-text-muted italic">
                    No active sessions found. Create one using the form.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tickets View */}
      {viewMode === 'tickets' && (
        <div className="glass-panel p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-brand-border pb-6 gap-4">
            <div>
              <button onClick={returnToDashboard} className="text-brand-text-muted hover:text-brand-text text-sm font-semibold transition-colors mb-2 flex items-center gap-1 cursor-pointer">← Back to Dashboard</button>
              <h2 className="text-2xl font-bold text-brand-text">Session Tickets: <span className="text-brand-emerald">{liveSession?.sessionName}</span></h2>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.print()} className="bg-brand-bg hover:bg-brand-card border border-brand-border text-brand-text px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer">🖨️ Print</button>
              <button onClick={copyAllTickets} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer">📋 Copy All</button>
              <button onClick={exportCSV} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer">📥 Export CSV</button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex gap-4">
              <div className="glass-panel px-4 py-2.5 rounded-2xl border border-brand-border flex items-center gap-3">
                <span className="text-xs text-brand-text-muted font-semibold uppercase">Total</span>
                <span className="text-xl font-bold text-brand-text">{sessionTickets.length}</span>
              </div>
              <div className="glass-panel px-4 py-2.5 rounded-2xl border border-brand-border flex items-center gap-3">
                <span className="text-xs text-brand-text-muted font-semibold uppercase">Joined</span>
                <span className="text-xl font-bold text-brand-emerald">{sessionTickets.filter(t => t.playerStatus === 'PLAYING').length}</span>
              </div>
            </div>
            <input 
              type="text" 
              placeholder="Search Code..." 
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              className="p-3 rounded-2xl bg-brand-input border border-brand-input-border text-brand-text text-sm outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-brand-emerald w-full sm:w-64 font-mono shadow-sm" 
            />
          </div>

          {ticketError && <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-2xl mb-6 text-sm">{ticketError}</div>}
          
          {isLoadingTickets ? (
            <p className="text-brand-text-muted text-center py-12">Loading ticket list...</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-brand-border shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-bg text-brand-text-muted text-xs font-bold uppercase tracking-wider">
                    <th className="p-4 border-b border-brand-border">S.No</th>
                    <th className="p-4 border-b border-brand-border">Ticket Code</th>
                    <th className="p-4 border-b border-brand-border">Player Name</th>
                    <th className="p-4 border-b border-brand-border">Ticket Status</th>
                    <th className="p-4 border-b border-brand-border">Player Status</th>
                    <th className="p-4 border-b border-brand-border">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-sm">
                  {(Array.isArray(sessionTickets) ? sessionTickets : []).filter(t => t.ticketCode.includes(ticketSearch.toUpperCase())).map((ticket, index) => (
                    <tr key={ticket.ticketCode} className="hover:bg-brand-bg/60 transition-colors">
                      <td className="p-4 text-brand-text-muted font-medium">{index + 1}</td>
                      <td className="p-4 font-mono text-brand-emerald font-extrabold text-base">{ticket.ticketCode}</td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          placeholder="Assign Name..."
                          defaultValue={ticket.playerName || ''}
                          onBlur={(e) => {
                            if(e.target.value !== ticket.playerName) handleAssignName(ticket.ticketCode, e.target.value);
                          }}
                          className="bg-brand-input text-brand-text p-2 rounded-xl border border-brand-input-border focus:border-brand-emerald text-sm outline-none w-full max-w-xs font-medium"
                        />
                      </td>
                      <td className="p-4 text-brand-text-sec font-medium">Active</td>
                      <td className="p-4">
                        {ticket.playerStatus === 'PLAYING' 
                          ? <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Joined</span>
                          : <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-bg text-brand-text-muted border border-brand-border">Not Joined</span>
                        }
                      </td>
                      <td className="p-4">
                        <button onClick={() => copyToClipboard(ticket.ticketCode)} className="text-brand-blue hover:underline text-xs font-bold cursor-pointer">Copy Code</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Monitor View */}
      {viewMode === 'monitor' && (
        <div className="space-y-8">
          <div className="glass-panel p-4 rounded-3xl border border-brand-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <button onClick={returnToDashboard} className="text-brand-text-muted hover:text-brand-text text-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer">← Back to Dashboard</button>
            
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={toggleVoice}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-semibold text-xs transition-all border cursor-pointer ${isVoiceEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'bg-brand-card border-brand-border text-brand-text-muted hover:bg-brand-bg'}`}
              >
                {isVoiceEnabled ? '🔊 Voice ON' : '🔈 Voice OFF'}
              </button>

              {adminStats?.gameStatus === 'WAITING' && (
                <button onClick={() => executeControl('start')} className="premium-btn-success shadow-sm px-6 py-2">Start Game ▶</button>
              )}
              {adminStats?.gameStatus === 'LIVE' && (
                <button onClick={() => executeControl('pause')} className="bg-amber-500 hover:bg-amber-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold transition-all cursor-pointer">Pause Game ⏸</button>
              )}
              {adminStats?.gameStatus === 'PAUSED' && (
                <button onClick={() => executeControl('resume')} className="premium-btn-success shadow-sm px-6 py-2">Resume Game ▶</button>
              )}
              {(adminStats?.gameStatus === 'LIVE' || adminStats?.gameStatus === 'PAUSED') && (
                <button onClick={() => { if(window.confirm('Are you sure you want to end this game?')) executeControl('end') }} className="bg-red-500 hover:bg-red-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold transition-all cursor-pointer">End Game 🛑</button>
              )}
              {adminStats?.gameStatus === 'COMPLETED' && (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold px-4 py-2 flex items-center gap-2">✓ Game Finished</span>
                  <button onClick={() => setViewMode('tickets')} className="bg-brand-card hover:bg-brand-bg border border-brand-border text-brand-text px-4 py-2 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer">View Summary</button>
                  <button onClick={() => handleDeleteSession(liveSession._id, liveSession.sessionName)} className="bg-red-600/10 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white px-4 py-2 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer">Archive Session</button>
                </>
              )}
            </div>
          </div>
          
          {adminStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {adminStats?.gameStatus === 'PAUSED' && pauseCountdown > 0 && (
                <div className="absolute inset-0 z-20 backdrop-blur-md bg-brand-bg/80 flex flex-col items-center justify-center p-6 text-center animate-fade-in border border-brand-border/50 rounded-3xl">
                  <span className="text-2xl mb-1 animate-bounce">🏆</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-lg mb-1">Prize Verification in Progress</span>
                  <span className="text-brand-text-muted text-xs mb-3">Game is paused for validation...</span>
                  <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-2">Resuming in {pauseCountdown}s</span>
                </div>
              )}
              <div className="glass-panel-secondary p-6 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-brand-text-muted mb-2 uppercase tracking-widest">Current Drawn</p>
                <p className="text-5xl font-black tracking-tight">{adminStats.currentNumber || '-'}</p>
                {adminStats?.gameStatus === 'LIVE' && nextDrawCountdown !== null && (
                  <div className="mt-4 text-xs font-bold text-brand-text-sec bg-brand-card px-4 py-1.5 rounded-full flex items-center justify-center gap-2 animate-pulse border border-brand-border shadow-sm w-max">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Next draw in: {nextDrawCountdown}s
                  </div>
                )}
              </div>
              
              <div className="glass-panel p-6 rounded-3xl border border-brand-border flex flex-col items-center justify-center text-center shadow-premium">
                <p className="text-brand-text-muted text-xs uppercase font-bold tracking-wider mb-2">Online Players</p>
                <p className="text-4xl font-black text-brand-emerald">{adminStats.onlineCount || 0} <span className="text-lg text-brand-text-muted">/ {adminStats.totalJoined || liveSession.totalPlayers}</span></p>
              </div>
              <div className="glass-panel p-6 rounded-3xl border border-brand-border flex flex-col items-center justify-center text-center shadow-premium">
                <p className="text-brand-text-muted text-xs uppercase font-bold tracking-wider mb-2">Remaining Nums</p>
                <p className="text-4xl font-black text-amber-500">{adminStats.remainingNumbers !== undefined ? adminStats.remainingNumbers : 90}</p>
              </div>
              <div className="glass-panel p-6 rounded-3xl border border-brand-border flex flex-col shadow-premium max-h-64 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-brand-text flex items-center gap-2">🕹️ Live Dashboard</h3>
                <div className="flex gap-2">
                  {adminStats?.gameStatus === 'WAITING' && <span className="status-badge-amber">Waiting to Start</span>}
                  {adminStats?.gameStatus === 'LIVE' && <span className="status-badge-emerald">Live & Active</span>}
                  {adminStats?.gameStatus === 'PAUSED' && <span className="status-badge-blue">Prize Verification</span>}
                  {adminStats?.gameStatus === 'COMPLETED' && <span className="status-badge-blue">Game Over</span>}
                </div>
              </div>
                <p className="text-brand-text-muted text-xs uppercase font-bold tracking-wider mb-3 text-center sticky top-0 bg-brand-card pb-1">Configured Prizes</p>
                <div className="space-y-3">
                  {(adminStats?.prizes || []).map(prize => {
                    const isWon = prize.status === 'COMPLETED';
                    return (
                      <div key={prize.id} className={`bg-brand-bg p-4 rounded-2xl border transition-all duration-300 shadow-sm ${isWon ? 'border-l-4 border-l-emerald-500 border-t-brand-border border-r-brand-border border-b-brand-border bg-emerald-500/5' : 'border-brand-border hover:shadow-md'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-bold text-xs ${isWon ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-blue'}`}>{prize.name}</span>
                          <span className="text-[10px] text-brand-text-muted font-mono uppercase bg-brand-card px-2 py-0.5 rounded-full border border-brand-border">{prize.status}</span>
                        </div>
                        {isWon ? (
                          <div className="text-xs text-brand-text-sec mt-2">
                            <p>Winner: <strong className="text-emerald-500">{prize.winner}</strong> (#{prize.winnerTicket})</p>
                          </div>
                        ) : (
                          <p className="text-brand-text-muted italic text-xs mt-2 opacity-70">Waiting...</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-brand-emerald font-bold animate-pulse text-center py-8">Connecting to live session feed...</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 glass-panel p-6 sm:p-8">
              <h2 className="text-xs text-brand-text-muted mb-6 font-bold uppercase tracking-wider">Master Draw History</h2>
              <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
                {Array.from({length: 90}, (_, i) => i + 1).map(num => {
                  const isDrawn = adminStats?.drawnNumbers?.includes(num);
                  return (
                    <div 
                      key={num}
                      className={`flex items-center justify-center p-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-300
                        board-cell ${isDrawn ? "drawn animate-draw-pulse" : ""}
                      `}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel p-6 sm:p-8 flex flex-col">
              <h2 className="text-xs text-brand-text-muted mb-4 font-bold uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2.5 animate-pulse"></span>
                Live Activity Feed
              </h2>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px]">
                {(Array.isArray(activityFeed) ? activityFeed : []).length > 0 ? (
                  (Array.isArray(activityFeed) ? activityFeed : []).map((feed, idx) => (
                    <div key={idx} className="glass-panel-secondary p-4 border border-brand-border shadow-sm text-xs">
                      <span className="text-brand-text-muted font-mono block mb-1">
                        {feed.time.toLocaleTimeString()}
                      </span>
                      <span className="text-brand-text font-medium">
                        {feed.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-brand-text-muted italic text-center py-12 text-xs">Waiting for live activity...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
