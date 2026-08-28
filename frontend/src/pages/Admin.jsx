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
    { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true, prizeItem: '', sponsor: '' },
    { id: 'p2', name: 'Four Corners', type: 'FourCorners', sequence: 1, enabled: true, prizeItem: '', sponsor: '' },
    { id: 'p3', name: 'Six Corners', type: 'SixCorners', sequence: 1, enabled: true, prizeItem: '', sponsor: '' },
    { id: 'p4', name: 'Middle Number', type: 'MiddleNumber', sequence: 1, enabled: true, prizeItem: '', sponsor: '' },
    { id: 'p5', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true, prizeItem: '', sponsor: '' },
    { id: 'p6', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true, prizeItem: '', sponsor: '' },
    { id: 'p7', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true, prizeItem: '', sponsor: '' },
    { id: 'p8', name: 'Full House', type: 'FullHouse', sequence: 1, enabled: true, prizeItem: '', sponsor: '' }
  ]);
  const [customPrizeName, setCustomPrizeName] = useState('');
  const [customPrizeItem, setCustomPrizeItem] = useState('');
  const [customPrizeSponsor, setCustomPrizeSponsor] = useState('');
  const [customPrizeType, setCustomPrizeType] = useState('Jaldi5');

  const [logo1, setLogo1] = useState('');
  const [logo2, setLogo2] = useState('');
  const [logo3, setLogo3] = useState('');

  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('adminViewContext');
    if (saved) {
        try { return JSON.parse(saved).viewMode || 'dashboard'; } catch(e) {}
    }
    return 'dashboard';
  });
  const [liveSession, setLiveSession] = useState(() => {
    const saved = localStorage.getItem('adminViewContext');
    if (saved) {
        try { return JSON.parse(saved).liveSession || null; } catch(e) {}
    }
    return null;
  });
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
    if (viewMode === 'dashboard') {
        localStorage.removeItem('adminViewContext');
    } else {
        localStorage.setItem('adminViewContext', JSON.stringify({ viewMode, liveSession }));
    }
  }, [viewMode, liveSession]);

  const fetchSessionTicketsSilent = async (sessionId) => {
    if (!sessionId || !token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/game/${sessionId}/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessionTickets(data);
        }
      }
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    if (viewMode !== 'tickets' || !liveSession?._id) return;
    const interval = setInterval(() => {
      fetchSessionTicketsSilent(liveSession._id);
    }, 3000);
    return () => clearInterval(interval);
  }, [viewMode, liveSession?._id, token]);

  useEffect(() => {
    if ((viewMode === 'monitor' || viewMode === 'tickets') && liveSession) {
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
        if (liveSession?._id) fetchSessionTicketsSilent(liveSession._id);
      });

      socketRef.current.on('join_request_created', ({ ticketCode, playerName }) => {
        setActivityFeed(prev => [{
          time: new Date(),
          message: `📩 Join Request from ${playerName || 'Player'} (#${ticketCode})`
        }, ...prev.slice(0, 19)]);
        if (liveSession?._id) fetchSessionTicketsSilent(liveSession._id);
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
          prizes: prizes.filter(p => p.enabled),
          logos: [logo1, logo2, logo3]
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to create game');

      setSuccessMsg(`Session created successfully! Session ID: ${data.session.sessionId}`);
      setSessionName('');
      setStartTime('');
      setLogo1('');
      setLogo2('');
      setLogo3('');
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

  const handleToggleActive = async (ticketCode, currentIsActive) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000');
      const newIsActive = !currentIsActive;
      
      // Optimistically update local state
      setSessionTickets(prev => prev.map(t => t.ticketCode === ticketCode ? { ...t, isActive: newIsActive } : t));

      const res = await fetch(`${apiUrl}/api/game/${liveSession._id}/tickets/${ticketCode}/active`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: newIsActive })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Server returned an invalid response.');
      }
      
      if (!res.ok) {
        // Revert local state on error
        setSessionTickets(prev => prev.map(t => t.ticketCode === ticketCode ? { ...t, isActive: currentIsActive } : t));
        throw new Error(data.message || 'Failed to update ticket active status');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTicketRequestAction = async (ticketCode, action) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000');
      const isAccept = action === 'ACCEPT';
      
      // Optimistically update local state
      setSessionTickets(prev => prev.map(t => t.ticketCode === ticketCode ? { 
        ...t, 
        isActive: isAccept, 
        requestStatus: isAccept ? 'ACCEPTED' : 'DECLINED' 
      } : t));

      const res = await fetch(`${apiUrl}/api/game/${liveSession._id}/tickets/${ticketCode}/request`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Server returned an invalid response.');
      }
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update request');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAcceptAllRequests = async () => {
    if (!liveSession?._id) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000');
      
      // Optimistically update local state for all pending tickets
      setSessionTickets(prev => prev.map(t => t.requestStatus === 'PENDING' ? {
        ...t,
        isActive: true,
        requestStatus: 'ACCEPTED'
      } : t));

      const res = await fetch(`${apiUrl}/api/game/${liveSession._id}/tickets/accept-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.updatedCount > 0) {
          fetchSessionTicketsSilent(liveSession._id);
        }
      }
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
      
      if (action === 'start') {
        const maskedToken = token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : 'NULL_OR_EMPTY';
        console.log(`[Frontend Auth Debug] Action: ${action}`);
        console.log(`[Frontend Auth Debug] URL: ${apiUrl}/api/game/${liveSession._id}/${action}`);
        console.log(`[Frontend Auth Debug] Token exists: ${!!token}`);
        console.log(`[Frontend Auth Debug] Header: Bearer ${maskedToken}`);
      }

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
    const list = sessionTickets.map((t, idx) => `${idx + 1}. Code: ${t.ticketCode} | Player: ${t.playerName || 'Unassigned'} | Active: ${t.isActive ? 'Yes' : 'No'}`).join('\n');
    navigator.clipboard.writeText(list);
    alert('All Ticket details copied to clipboard!');
  };

  const exportCSV = () => {
    const csvRows = ['S.No,Ticket Code,Player Name,Active Access,Player Status'];
    sessionTickets.forEach((t, idx) => {
      csvRows.push(`${idx + 1},${t.ticketCode},"${t.playerName || ''}",${t.isActive ? 'Active' : 'Inactive'},${t.playerStatus}`);
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
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBEB] via-[#F8FAFC] to-[#F3E8FF] p-4 sm:p-8 font-sans text-slate-800 relative">
      <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_60px_rgba(147,51,234,0.06)] border border-purple-100/80">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-purple-100/60 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-200 via-amber-100 to-yellow-50 border border-amber-300/60 shadow-xs flex items-center justify-center text-xl shrink-0">
              👑
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
                Manage your housie sessions with ease ✨
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button 
              onClick={handleLogout} 
              className="border border-red-200 bg-white text-red-500 hover:bg-red-50 font-bold px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-2xs cursor-pointer transition-all"
            >
              <span>Logout</span>
              <span className="text-base">🚪</span>
            </button>
          </div>
        </div>

        {/* Dashboard View */}
        {viewMode === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Session Form Card */}
            <div className="bg-[#FAFAFD] border border-purple-100/80 rounded-[2rem] p-6 sm:p-7 shadow-xs relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                  ➕
                </div>
                <h2 className="text-lg font-black text-[#0F172A]">
                  Create New Session
                </h2>
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium">{error}</div>}
              {successMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-4 rounded-2xl mb-6 text-sm font-medium">{successMsg}</div>}
              
              <form onSubmit={handleCreateGame} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black text-purple-900/60 uppercase tracking-wider mb-2">SESSION TITLE</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">📄</span>
                    <input type="text" required value={sessionName} onChange={e => setSessionName(e.target.value)} className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 pl-10 text-sm font-semibold text-[#0F172A] placeholder-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all shadow-2xs" placeholder="E.g. Friday Evening Housie" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-purple-900/60 uppercase tracking-wider mb-2">TOTAL PLAYERS</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">👥</span>
                      <input type="number" min="1" max="1000" required value={totalPlayers} onChange={e => setTotalPlayers(e.target.value)} className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 pl-10 text-sm font-semibold text-[#0F172A] placeholder-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all shadow-2xs" placeholder="10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-purple-900/60 uppercase tracking-wider mb-2">START TIME</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">📅</span>
                      <input type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 pl-10 text-xs font-semibold text-[#0F172A] focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all shadow-2xs cursor-pointer" />
                    </div>
                  </div>
                </div>

                {/* Ticket Code Generation segmented control */}
                <div>
                  <label className="block text-[11px] font-black text-purple-900/60 uppercase tracking-wider mb-2">TICKET CODE GENERATION</label>
                  <div className="bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setTicketCodeMode('RANDOM')}
                      className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ticketCodeMode === 'RANDOM' ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      <span>🎲</span> Random Codes
                    </button>
                    <button
                      type="button"
                      onClick={() => setTicketCodeMode('PATTERN')}
                      className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${ticketCodeMode === 'PATTERN' ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      <span>⚆</span> Custom Pattern
                    </button>
                  </div>
                </div>

                {ticketCodeMode === 'PATTERN' && (
                  <div>
                    <label className="block text-[11px] font-black text-purple-900/60 uppercase tracking-wider mb-2">STARTING REGISTER CODE</label>
                    <input type="text" required value={startingRegisterNumber} onChange={e => setStartingRegisterNumber(e.target.value)} className="w-full bg-white border border-slate-200/90 rounded-2xl p-3.5 text-sm font-mono font-semibold text-[#0F172A] placeholder-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all shadow-2xs" placeholder="E.G. A1 OR 24B91A0701" />
                  </div>
                )}

                {/* Logo Configuration */}
                <div className="space-y-2.5 border-t border-purple-100/80 pt-4">
                  <label className="block text-[11px] font-black text-purple-900/60 uppercase tracking-wider">DICE LOGOS (IMAGE URLS)</label>
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🖼️</span>
                      <input type="text" value={logo1} onChange={e => setLogo1(e.target.value)} placeholder="Logo 1 URL (e.g. https://example.com/logo1.png)" className="w-full bg-white border border-slate-200/90 rounded-2xl p-3 pl-10 text-xs font-medium text-[#0F172A] placeholder-slate-400 focus:border-purple-500 outline-none" />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🖼️</span>
                      <input type="text" value={logo2} onChange={e => setLogo2(e.target.value)} placeholder="Logo 2 URL" className="w-full bg-white border border-slate-200/90 rounded-2xl p-3 pl-10 text-xs font-medium text-[#0F172A] placeholder-slate-400 focus:border-purple-500 outline-none" />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🖼️</span>
                      <input type="text" value={logo3} onChange={e => setLogo3(e.target.value)} placeholder="Logo 3 URL" className="w-full bg-white border border-slate-200/90 rounded-2xl p-3 pl-10 text-xs font-medium text-[#0F172A] placeholder-slate-400 focus:border-purple-500 outline-none" />
                    </div>
                  </div>
                  {(logo1 || logo2 || logo3) && (
                    <div className="flex gap-2 p-2 bg-white border border-slate-200 rounded-xl">
                      {logo1 && <img src={logo1} alt="Logo 1" className="w-8 h-8 object-contain rounded bg-slate-50" onError={(e) => e.target.style.display='none'} />}
                      {logo2 && <img src={logo2} alt="Logo 2" className="w-8 h-8 object-contain rounded bg-slate-50" onError={(e) => e.target.style.display='none'} />}
                      {logo3 && <img src={logo3} alt="Logo 3" className="w-8 h-8 object-contain rounded bg-slate-50" onError={(e) => e.target.style.display='none'} />}
                    </div>
                  )}
                </div>

                {/* Prize Configuration */}
                <div className="space-y-3 border-t border-purple-100/80 pt-4">
                  <label className="block text-[11px] font-black text-purple-900/60 uppercase tracking-wider">CONFIGURED PRIZES</label>
                  <div className="flex flex-col gap-2.5 max-h-[22rem] overflow-y-auto pr-1">
                    {prizes.map((prize, idx) => (
                      <div key={prize.id} className="flex flex-col gap-2 bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-3 shadow-2xs">
                        <div className="flex items-center justify-between w-full">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={prize.enabled} 
                              onChange={(e) => {
                                const newPrizes = [...prizes];
                                newPrizes[idx].enabled = e.target.checked;
                                setPrizes(newPrizes);
                              }} 
                              className="accent-emerald-600 rounded cursor-pointer w-4 h-4" 
                            />
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <span>🏆</span> {prize.name}
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="bg-[#A7F3D0]/60 text-[#047857] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">AVAILABLE</span>
                            <button 
                              type="button" 
                              onClick={() => setPrizes(prev => prev.filter(p => p.id !== prize.id))}
                              className="text-red-400 hover:text-red-600 transition-colors p-1 text-xs font-bold cursor-pointer"
                              title="Delete prize"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 w-full pt-1 border-t border-emerald-200/60">
                          <input 
                            type="text" 
                            value={prize.prizeItem || ''} 
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].prizeItem = e.target.value;
                              setPrizes(newPrizes);
                            }} 
                            placeholder="Add Prize Item (e.g. Gold Coin)" 
                            className="flex-1 p-2 rounded-xl bg-white border border-emerald-200 text-slate-800 text-xs outline-none focus:border-emerald-500" 
                          />
                          <input 
                            type="text" 
                            value={prize.sponsor || ''} 
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].sponsor = e.target.value;
                              setPrizes(newPrizes);
                            }} 
                            placeholder="Sponsor (Optional)" 
                            className="flex-1 p-2 rounded-xl bg-white border border-emerald-200 text-slate-800 text-xs outline-none focus:border-emerald-500" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex flex-col gap-2.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="text" value={customPrizeName} onChange={e => setCustomPrizeName(e.target.value)} placeholder="Custom Prize Name" className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:border-purple-500" />
                      <input type="text" value={customPrizeItem} onChange={e => setCustomPrizeItem(e.target.value)} placeholder="Prize Item (Optional)" className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:border-purple-500" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="text" value={customPrizeSponsor} onChange={e => setCustomPrizeSponsor(e.target.value)} placeholder="Sponsor (Optional)" className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:border-purple-500" />
                      <select value={customPrizeType} onChange={e => setCustomPrizeType(e.target.value)} className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none cursor-pointer">
                        <option value="Jaldi5">Jaldi 5</option>
                        <option value="FourCorners">Four Corners</option>
                        <option value="SixCorners">Six Corners</option>
                        <option value="MiddleNumber">Middle Number</option>
                        <option value="FirstLine">First Line</option>
                        <option value="SecondLine">Second Line</option>
                        <option value="ThirdLine">Third Line</option>
                        <option value="FullHouse">Full House</option>
                      </select>
                      <button type="button" onClick={() => {
                        if(!customPrizeName.trim()) return;
                        const sameType = prizes.filter(p => p.type === customPrizeType);
                        const sequence = sameType.length > 0 ? Math.max(...sameType.map(p => p.sequence)) + 1 : 1;
                        setPrizes([...prizes, { id: 'cp' + Date.now(), name: customPrizeName, type: customPrizeType, sequence, enabled: true, prizeItem: customPrizeItem, sponsor: customPrizeSponsor }]);
                        setCustomPrizeName('');
                        setCustomPrizeItem('');
                        setCustomPrizeSponsor('');
                      }} className="bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-xs cursor-pointer whitespace-nowrap">Add Prize</button>
                    </div>
                  </div>
                </div>
                
                <button type="submit" className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-purple-600 hover:to-indigo-600 text-white font-black py-3.5 rounded-2xl transition-all shadow-md shadow-purple-500/20 cursor-pointer text-base flex items-center justify-center gap-2">
                  <span>Create Game Session</span>
                  <span>✨</span>
                </button>
              </form>
            </div>

            {/* All Sessions Card */}
            <div className="bg-[#FAFAFD] border border-purple-100/80 rounded-[2rem] p-6 sm:p-7 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                    📋
                  </div>
                  <h2 className="text-lg font-black text-[#0F172A]">
                    All Sessions ({activeSessions.length})
                  </h2>
                </div>

                {sessionError && <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 text-sm">{sessionError}</div>}
                
                {isLoadingSessions ? (
                  <p className="text-slate-500 font-semibold text-center py-8">Loading active sessions...</p>
                ) : (
                  <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                    {(Array.isArray(activeSessions) ? activeSessions : []).map(session => {
                      const isPaused = session.gameStatus === 'PAUSED';
                      const isCompleted = session.gameStatus === 'COMPLETED';
                      const isLive = session.gameStatus === 'LIVE';
                      
                      const leftBorder = isPaused ? 'border-l-amber-400' : isCompleted ? 'border-l-emerald-400' : isLive ? 'border-l-blue-400' : 'border-l-purple-400';
                      const avatarBg = isPaused ? 'bg-amber-50 border-amber-200/60' : isCompleted ? 'bg-emerald-50 border-emerald-200/60' : isLive ? 'bg-blue-50 border-blue-200/60' : 'bg-purple-50 border-purple-200/60';
                      const avatarIcon = isPaused ? '☀️' : isCompleted ? '🏔️' : isLive ? '🗓️' : '🌙';
                      const badgeStyle = isPaused ? 'bg-amber-100 text-amber-700' : isCompleted ? 'bg-emerald-100 text-emerald-700' : isLive ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';

                      return (
                        <div key={session._id} className={`p-4 bg-white rounded-2xl border-l-4 ${leftBorder} border-y border-r border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all`}>
                          <div className="flex items-center gap-3.5">
                            <div className={`w-10 h-10 rounded-2xl ${avatarBg} border flex items-center justify-center text-lg shrink-0`}>
                              {avatarIcon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-black text-[#0F172A] text-base">{session.sessionName}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeStyle}`}>
                                  {session.gameStatus}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                <span>📅 Starts:</span>
                                <strong className="text-slate-700">{new Date(session.startTime).toLocaleString()}</strong>
                              </p>
                              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                                <span>🎟️ Tickets Allocated:</span>
                                <strong className="text-purple-700 font-extrabold">{session.totalPlayers}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <button onClick={() => viewSessionTickets(session)} className="flex-1 sm:flex-none border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all">
                              <span>🎟️</span> Tickets
                            </button>
                            <button onClick={() => monitorSession(session)} className="flex-1 sm:flex-none bg-[#F3E8FF] border border-[#DDD6FE] text-[#7C3AED] hover:bg-[#EDE9FE] font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all">
                              <span>⚙️</span> Manage
                            </button>
                            <button onClick={() => handleDeleteSession(session._id, session.sessionName)} className="flex-1 sm:flex-none bg-[#FFE4E6] border border-[#FECDD3] text-[#E11D48] hover:bg-[#FCE7F3] font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all">
                              <span>🗑️</span> Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(Array.isArray(activeSessions) ? activeSessions : []).length === 0 && (
                      <div className="text-center py-12 text-slate-400 font-semibold italic">
                        No active sessions found. Create one using the form.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button type="button" onClick={() => fetchActiveSessions()} className="w-full mt-4 bg-[#F3E8FF] hover:bg-[#EDE9FE] text-[#7C3AED] font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <span>📑</span> View All Sessions ➔
              </button>
            </div>
          </div>
        )}

      {/* Tickets View */}
      {viewMode === 'tickets' && (
        <div className="glass-panel p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-brand-border pb-6 gap-4">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <button onClick={returnToDashboard} className="text-brand-text-muted hover:text-brand-text text-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer">← Back to Dashboard</button>
                {liveSession && (
                  <button onClick={() => setViewMode('monitor')} className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold flex items-center gap-1 cursor-pointer">🕹️ Back to Live Monitor</button>
                )}
              </div>
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
              placeholder="Search Name or Code..." 
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              className="p-3 rounded-2xl bg-brand-input border border-brand-input-border text-brand-text text-sm outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-brand-emerald w-full sm:w-64 font-medium shadow-sm" 
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
                    <th className="p-4 border-b border-brand-border">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span>Access Control</span>
                        <button
                          onClick={handleAcceptAllRequests}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1 normal-case tracking-normal"
                          title="Accept all pending player invitations at once"
                        >
                          ✓ Accept All Invitations
                        </button>
                      </div>
                    </th>
                    <th className="p-4 border-b border-brand-border">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-sm">
                  {(Array.isArray(sessionTickets) ? sessionTickets : []).filter(t => {
                    if (!ticketSearch) return true;
                    const q = ticketSearch.trim().toLowerCase();
                    const codeMatch = (t.ticketCode || '').toLowerCase().includes(q);
                    const nameMatch = (t.playerName || '').toLowerCase().includes(q);
                    return codeMatch || nameMatch;
                  }).map((ticket, index) => (
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
                      <td className="p-4 font-medium">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${ticket.isActive ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
                          {ticket.isActive ? 'Active (ON)' : 'Inactive (OFF)'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* ON/OFF Switch Toggle Button */}
                          <button
                            onClick={() => handleToggleActive(ticket.ticketCode, ticket.isActive)}
                            className={`relative inline-flex items-center h-7 rounded-full w-16 p-1 cursor-pointer transition-colors duration-300 shadow-sm focus:outline-none ${
                              ticket.isActive 
                                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' 
                                : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'
                            }`}
                            title={ticket.isActive ? 'Switch OFF to deactivate ticket' : 'Switch ON to activate ticket'}
                          >
                            <span
                              className={`inline-block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                                ticket.isActive ? 'translate-x-9' : 'translate-x-0'
                              }`}
                            />
                            <span className={`absolute text-[10px] font-black tracking-wider uppercase select-none ${
                              ticket.isActive ? 'left-2 text-white' : 'right-2 text-white'
                            }`}>
                              {ticket.isActive ? 'ON' : 'OFF'}
                            </span>
                          </button>

                          {/* Accept and Decline Request Buttons */}
                          {ticket.requestStatus === 'PENDING' && (
                            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 p-1 rounded-xl">
                              <button
                                onClick={() => handleTicketRequestAction(ticket.ticketCode, 'ACCEPT')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                title="Accept join request"
                              >
                                ✓ Accept
                              </button>
                              <button
                                onClick={() => handleTicketRequestAction(ticket.ticketCode, 'DECLINE')}
                                className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                title="Decline join request"
                              >
                                ✕ Decline
                              </button>
                            </div>
                          )}

                          {ticket.requestStatus === 'ACCEPTED' && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                              Accepted
                            </span>
                          )}

                          {ticket.requestStatus === 'DECLINED' && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider">
                              Declined
                            </span>
                          )}

                          {ticket.playerStatus === 'PLAYING' && (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              Joined
                            </span>
                          )}
                        </div>
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
                <>
                  <button onClick={() => executeControl('start')} className="premium-btn-success shadow-sm px-6 py-2">Start Game ▶</button>
                  <button onClick={() => viewSessionTickets(liveSession)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold transition-all cursor-pointer hover:shadow-md">Tickets 🎟️</button>
                </>
              )}
              {adminStats?.gameStatus === 'LIVE' && (
                <>
                  <button onClick={() => executeControl('pause')} className="bg-amber-500 hover:bg-amber-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold transition-all cursor-pointer">Pause Game ⏸</button>
                  <button onClick={() => viewSessionTickets(liveSession)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold transition-all cursor-pointer hover:shadow-md">Tickets 🎟️</button>
                </>
              )}
              {adminStats?.gameStatus === 'PAUSED' && (
                <>
                  <button onClick={() => executeControl('resume')} className="premium-btn-success shadow-sm px-6 py-2">Resume Game ▶</button>
                  <button onClick={() => viewSessionTickets(liveSession)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold transition-all cursor-pointer hover:shadow-md">Tickets 🎟️</button>
                </>
              )}
              {(adminStats?.gameStatus === 'LIVE' || adminStats?.gameStatus === 'PAUSED') && (
                <button onClick={() => { if(window.confirm('Are you sure you want to end this game?')) executeControl('end') }} className="bg-red-500 hover:bg-red-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold transition-all cursor-pointer">End Game 🛑</button>
              )}
              {adminStats?.gameStatus === 'COMPLETED' && (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold px-4 py-2 flex items-center gap-2">✓ Game Finished</span>
                  <button onClick={() => viewSessionTickets(liveSession)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-premium px-6 py-2 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer">Tickets 🎟️</button>
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
                {adminStats?.gameStatus === 'LIVE' && (
                  <div className="mt-4 text-xs font-bold text-brand-text-sec bg-brand-card px-4 py-1.5 rounded-full flex items-center justify-center gap-2 animate-pulse border border-brand-border shadow-sm w-max">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Next draw in: {nextDrawCountdown !== null ? nextDrawCountdown : 5}s
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
                          <div className="flex items-center gap-2">
                            {prize.prizeItem && <span className="text-xs font-semibold text-brand-text-sec text-right">{prize.prizeItem}</span>}
                            <span className="text-[10px] text-brand-text-muted font-mono uppercase bg-brand-card px-2 py-0.5 rounded-full border border-brand-border">{prize.status}</span>
                          </div>
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
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                  <h2 className="text-sm sm:text-base font-black text-brand-text uppercase tracking-wider">Master Draw History (1-90)</h2>
                  <p className="text-xs text-brand-text-muted font-semibold mt-0.5">Live game board matrix</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Generated Stats Card */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50/80 border border-blue-200/80 rounded-2xl px-3.5 py-1.5 sm:px-5 sm:py-2.5 flex flex-col items-center justify-center shadow-2xs">
                    <span className="text-blue-600 text-[10px] sm:text-xs font-black flex items-center gap-1">✦ Generated</span>
                    <span className="text-xl sm:text-2xl font-black text-blue-600 leading-tight">{adminStats?.drawnNumbers?.length || 0}</span>
                  </div>

                  {/* Pending Stats Card */}
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50/80 border border-orange-200/80 rounded-2xl px-3.5 py-1.5 sm:px-5 sm:py-2.5 flex flex-col items-center justify-center shadow-2xs">
                    <span className="text-orange-600 text-[10px] sm:text-xs font-black flex items-center gap-1">🕒 Pending</span>
                    <span className="text-xl sm:text-2xl font-black text-orange-600 leading-tight">{90 - (adminStats?.drawnNumbers?.length || 0)}</span>
                  </div>
                </div>
              </div>

              {/* 1-90 Grid Matrix (10 Columns x 9 Rows) matching User Interface Number Board */}
              <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 w-full my-2 relative z-10">
                {Array.from({length: 90}, (_, i) => i + 1).map(num => {
                  const isDrawn = adminStats?.drawnNumbers?.includes(num);
                  return (
                    <div 
                      key={`admin-num-board-${num}`}
                      className={`flex items-center justify-center aspect-square rounded-xl sm:rounded-2xl text-xs sm:text-base font-black transition-all duration-300 select-none ${
                        isDrawn
                          ? "bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)] border border-blue-400/40"
                          : "bg-white text-[#334155] shadow-[0_4px_10px_rgba(0,0,0,0.05)] border border-slate-100"
                      }`}
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
    </div>
  );
};

export default Admin;
