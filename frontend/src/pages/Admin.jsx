import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import useSpeech from '../hooks/useSpeech';

const Admin = () => {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [sessionName, setSessionName] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(50);
  const [startTime, setStartTime] = useState('');
  const [ticketCodeMode, setTicketCodeMode] = useState('RANDOM');
  const [startingRegisterNumber, setStartingRegisterNumber] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeSessions, setActiveSessions] = useState([]);
  
  const defaultPrizesList = [
    { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true },
    { id: 'p2', name: 'Jaldi 5 - 2', type: 'Jaldi5', sequence: 2, enabled: true },
    { id: 'p3', name: 'Jaldi 5 - 3', type: 'Jaldi5', sequence: 3, enabled: true },
    { id: 'p4', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true },
    { id: 'p5', name: 'First Line - 2', type: 'FirstLine', sequence: 2, enabled: true },
    { id: 'p6', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true },
    { id: 'p7', name: 'Second Line - 2', type: 'SecondLine', sequence: 2, enabled: true },
    { id: 'p8', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true },
    { id: 'p9', name: 'Third Line - 2', type: 'ThirdLine', sequence: 2, enabled: true },
    { id: 'p10', name: 'Full House 1', type: 'FullHouse', sequence: 1, enabled: true },
    { id: 'p11', name: 'Full House 2', type: 'FullHouse', sequence: 2, enabled: true },
    { id: 'p12', name: 'Full House 3', type: 'FullHouse', sequence: 3, enabled: true }
  ];
  const [prizes, setPrizes] = useState(defaultPrizesList);
  const [customPrizeName, setCustomPrizeName] = useState('');
  const [customPrizeType, setCustomPrizeType] = useState('FullHouse');
  
  const [viewMode, setViewMode] = useState('dashboard');
  const [liveSession, setLiveSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [sessionTickets, setSessionTickets] = useState([]);
  const [ticketSearch, setTicketSearch] = useState('');
  
  const [activityFeed, setActivityFeed] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const { isVoiceEnabled, toggleVoice, announceNumber } = useSpeech();

  const announceNumberRef = useRef(announceNumber);
  useEffect(() => {
    announceNumberRef.current = announceNumber;
  }, [announceNumber]);

  useEffect(() => {
    if (token) fetchActiveSessions();
  }, [token]);

  const fetchActiveSessions = async () => {
    setIsLoadingSessions(true);
    setSessionError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/game/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
          if (res.status === 401) {
              handleLogout();
              return;
          }
          throw new Error(data.message || 'Failed to fetch sessions');
      }
      setActiveSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSessionError(err.message || 'Error fetching sessions');
      setActiveSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      localStorage.setItem('adminToken', data.token);
      setToken(data.token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/game/create`, {
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
      if (!res.ok) {
          if (res.status === 401) {
              handleLogout();
              return;
          }
          throw new Error(data.message);
      }
      
      setSuccessMsg(`Success! Created ${data.ticketsGenerated} tickets for session "${data.session.sessionName}".`);
      setSessionName('');
      setStartTime('');
      setTicketCodeMode('RANDOM');
      setStartingRegisterNumber('');
      setPrizes(defaultPrizesList);
      fetchActiveSessions();
      viewSessionTickets(data.session);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    if (socket) socket.disconnect();
  };

  const viewSessionTickets = async (session) => {
    setLiveSession(session);
    setViewMode('tickets');
    setTicketSearch('');
    setIsLoadingTickets(true);
    setTicketError('');
    setSessionTickets([]);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/game/${session._id}/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
          if (res.status === 401) {
              handleLogout();
              return;
          }
          throw new Error(data.message || 'Failed to fetch tickets');
      }
      setSessionTickets(Array.isArray(data) ? data : []);
      
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
      newSocket.emit('join_game', { sessionId: session._id, role: 'admin' });
      newSocket.on('player_joined_status', (data) => {
          setSessionTickets(prev => Array.isArray(prev) ? prev.map(t => t.ticketCode === data.ticketCode ? { ...t, playerStatus: data.status } : t) : []);
      });
      setSocket(newSocket);
    } catch (err) {
      setTicketError('Error fetching tickets: ' + err.message);
      setSessionTickets([]);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleAssignName = async (ticketCode, newName) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/game/${liveSession._id}/tickets/${ticketCode}/name`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ playerName: newName })
      });
      if (!res.ok) {
          if (res.status === 401) {
              handleLogout();
              return;
          }
          throw new Error('Failed to save name');
      }
      
      setSessionTickets(prev => Array.isArray(prev) ? prev.map(t => t.ticketCode === ticketCode ? { ...t, playerName: newName } : t) : []);
    } catch (err) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  const copyAllTickets = () => {
    const safeTickets = Array.isArray(sessionTickets) ? sessionTickets : [];
    const codes = safeTickets.map(t => t.ticketCode).join('\n');
    navigator.clipboard.writeText(codes);
    alert('Copied all tickets to clipboard!');
  };

  const exportCSV = () => {
    const safeTickets = Array.isArray(sessionTickets) ? sessionTickets : [];
    const csvContent = "data:text/csv;charset=utf-8,Serial,Ticket Code,Ticket Status,Player Status\n" 
      + safeTickets.map((t, index) => `${index + 1},${t.ticketCode},Active,${t.playerStatus === 'PLAYING' ? 'Joined' : 'Not Joined'}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tickets_${liveSession.sessionName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monitorSession = (session) => {
    setLiveSession(session);
    setAdminStats({ ...session });
    setViewMode('monitor');
    setActivityFeed([]);
    
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    newSocket.emit('join_game', { sessionId: session._id, role: 'admin' });
    
    newSocket.on('admin_stats', (stats) => setAdminStats(prev => ({ ...prev, ...stats })));
    newSocket.on('game_sync', (data) => {
        setAdminStats(prev => ({ ...prev, ...data }));
    });
    newSocket.on('number_drawn', (data) => {
        setAdminStats(prev => ({ ...prev, currentNumber: data.number, drawnNumbers: data.history, remainingNumbers: 90 - data.history.length }));
        announceNumberRef.current(data.number);
    });
    newSocket.on('winner_announced', (data) => {
        setAdminStats(prev => ({ ...prev, winners: data.winners }));
    });
    newSocket.on('game_started', (data) => setAdminStats(prev => ({ ...prev, gameStatus: data.status })));
    newSocket.on('game_paused', (data) => setAdminStats(prev => ({ ...prev, gameStatus: data.status })));
    newSocket.on('game_resumed', (data) => setAdminStats(prev => ({ ...prev, gameStatus: data.status })));
    newSocket.on('game_ended', (data) => setAdminStats(prev => ({ ...prev, gameStatus: data.status })));
    
    newSocket.on('activity_feed', (data) => {
        setActivityFeed(prev => [{ ...data, time: new Date() }, ...prev].slice(0, 50));
    });
    
    setSocket(newSocket);
  };

  const returnToDashboard = () => {
    if (socket) socket.disconnect();
    setSocket(null);
    setLiveSession(null);
    setAdminStats(null);
    setSessionTickets([]);
    setActivityFeed([]);
    setTicketError('');
    setSessionError('');
    setViewMode('dashboard');
    fetchActiveSessions();
  };

  const executeControl = async (action) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/game/${liveSession._id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
          if (res.status === 401) {
              handleLogout();
              return;
          }
          throw new Error(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Hardcoded prizesList removed, using session configuration dynamically


  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-96 border border-slate-700">
          <h2 className="text-2xl mb-6 font-bold text-center text-emerald-400">Admin Login</h2>
          {error && <div className="text-red-400 mb-4 text-sm text-center bg-red-500/20 p-2 rounded">{error}</div>}
          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 mb-4 rounded bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 mb-6 rounded bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded transition-colors shadow-lg shadow-emerald-500/20">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-slate-900 text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-emerald-400">Admin Dashboard</h1>
        <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">Logout</button>
      </div>

      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-6 text-white">Create Session</h2>
            {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded mb-6">{error}</div>}
            {successMsg && <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 p-4 rounded mb-6">{successMsg}</div>}
            <form onSubmit={handleCreateGame} className="space-y-6">
              <input type="text" required value={sessionName} onChange={e => setSessionName(e.target.value)} className="w-full p-3 rounded bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Session Name" />
              <input type="number" min="1" max="1000" required value={totalPlayers} onChange={e => setTotalPlayers(e.target.value)} className="w-full p-3 rounded bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Total Players" />
              <input type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 rounded bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500" />
              
              <div className="space-y-2">
                <p className="text-slate-400 text-sm font-semibold">Ticket Code Mode</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-slate-300">
                    <input type="radio" name="ticketCodeMode" value="RANDOM" checked={ticketCodeMode === 'RANDOM'} onChange={() => setTicketCodeMode('RANDOM')} className="accent-emerald-500" />
                    Random Code
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input type="radio" name="ticketCodeMode" value="PATTERN" checked={ticketCodeMode === 'PATTERN'} onChange={() => setTicketCodeMode('PATTERN')} className="accent-emerald-500" />
                    Specific Number Pattern
                  </label>
                </div>
              </div>
              {ticketCodeMode === 'PATTERN' && (
                  <input type="text" required value={startingRegisterNumber} onChange={e => setStartingRegisterNumber(e.target.value)} className="w-full p-3 rounded bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Starting Ticket Code (e.g. A1, 24B91A0701)" />
              )}
              
              <div className="space-y-4 border-t border-slate-700 pt-4">
                <p className="text-slate-400 font-semibold mb-2">Prize Configuration</p>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                  {prizes.map((prize, idx) => (
                    <label key={prize.id} className="flex items-center gap-2 text-slate-300 bg-slate-900 p-2 rounded border border-slate-700">
                      <input 
                        type="checkbox" 
                        checked={prize.enabled} 
                        onChange={(e) => {
                          const newPrizes = [...prizes];
                          newPrizes[idx].enabled = e.target.checked;
                          setPrizes(newPrizes);
                        }} 
                        className="accent-emerald-500" 
                      />
                      {prize.name}
                    </label>
                  ))}
                </div>
                <div className="bg-slate-900 p-4 rounded border border-slate-700 flex flex-col sm:flex-row gap-2 mt-4">
                  <input type="text" value={customPrizeName} onChange={e => setCustomPrizeName(e.target.value)} placeholder="Custom Prize Name" className="flex-1 p-2 rounded bg-slate-950 border border-slate-700 text-white text-sm outline-none" />
                  <select value={customPrizeType} onChange={e => setCustomPrizeType(e.target.value)} className="p-2 rounded bg-slate-950 border border-slate-700 text-white text-sm outline-none">
                    <option value="Jaldi5">Jaldi 5</option>
                    <option value="FirstLine">First Line</option>
                    <option value="SecondLine">Second Line</option>
                    <option value="ThirdLine">Third Line</option>
                    <option value="FullHouse">Full House</option>
                    <option value="FourCorners">Four Corners</option>
                    <option value="EarlySeven">Early Seven</option>
                  </select>
                  <button type="button" onClick={() => {
                    if(!customPrizeName.trim()) return;
                    const sameType = prizes.filter(p => p.type === customPrizeType);
                    const sequence = sameType.length > 0 ? Math.max(...sameType.map(p => p.sequence)) + 1 : 1;
                    setPrizes([...prizes, { id: 'cp' + Date.now(), name: customPrizeName, type: customPrizeType, sequence, enabled: true }]);
                    setCustomPrizeName('');
                  }} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold text-white transition-colors">Add</button>
                </div>
              </div>
              
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/30">Create Session</button>
            </form>
          </div>

          <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-6 text-white">All Sessions</h2>
            {sessionError && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded mb-6">{sessionError}</div>}
            {isLoadingSessions ? (
               <p className="text-slate-400">Loading sessions...</p>
            ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {(Array.isArray(activeSessions) ? activeSessions : []).map(session => (
                <div key={session._id} className="p-4 bg-slate-950 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-emerald-400">{session.sessionName}</h3>
                    <p className="text-sm text-slate-400">Starts: {new Date(session.startTime).toLocaleString()}</p>
                    <p className="text-sm text-slate-400">Tickets: {session.totalPlayers} | Status: <span className="text-white font-semibold">{session.gameStatus}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => viewSessionTickets(session)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded font-bold transition-colors">Tickets</button>
                    <button onClick={() => monitorSession(session)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded font-bold transition-colors">Manage</button>
                  </div>
                </div>
              ))}
              {(Array.isArray(activeSessions) ? activeSessions : []).length === 0 && <p className="text-slate-400">No sessions found.</p>}
            </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'tickets' && (
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
          <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
            <div>
              <button onClick={returnToDashboard} className="text-slate-400 hover:text-white transition-colors mb-2 flex items-center">← Back to Dashboard</button>
              <h2 className="text-2xl font-bold text-emerald-400">Tickets: {liveSession?.sessionName}</h2>
            </div>
            <div className="flex gap-4">
              <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-bold transition-colors">Print</button>
              <button onClick={copyAllTickets} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold transition-colors">Copy All</button>
              <button onClick={exportCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold transition-colors">Export CSV</button>
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-6">
              <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-sm block">Generated</span>
                <span className="text-2xl font-bold text-white">{sessionTickets.length}</span>
              </div>
              <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-sm block">Joined</span>
                <span className="text-2xl font-bold text-emerald-400">{sessionTickets.filter(t => t.playerStatus === 'PLAYING').length}</span>
              </div>
            </div>
            <input 
              type="text" 
              placeholder="Search Ticket Code..." 
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              className="p-3 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500 w-64" 
            />
          </div>

          {ticketError && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded mb-6">{ticketError}</div>}
          {isLoadingTickets ? (
             <p className="text-slate-400 text-center py-8">Loading tickets...</p>
          ) : (
          <div className="overflow-x-auto print:bg-white print:text-black">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 print:bg-gray-200">
                  <th className="p-4 border-b border-slate-700 font-semibold text-slate-300 print:text-black">S.No</th>
                  <th className="p-4 border-b border-slate-700 font-semibold text-slate-300 print:text-black">Ticket Code</th>
                  <th className="p-4 border-b border-slate-700 font-semibold text-slate-300 print:text-black">Player Name</th>
                  <th className="p-4 border-b border-slate-700 font-semibold text-slate-300 print:text-black">Ticket Status</th>
                  <th className="p-4 border-b border-slate-700 font-semibold text-slate-300 print:text-black">Player Status</th>
                  <th className="p-4 border-b border-slate-700 font-semibold text-slate-300 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(sessionTickets) ? sessionTickets : []).filter(t => t.ticketCode.includes(ticketSearch.toUpperCase())).map((ticket, index) => (
                  <tr key={ticket.ticketCode} className="hover:bg-slate-750 transition-colors">
                    <td className="p-4 border-b border-slate-700 text-slate-400 print:text-black">{index + 1}</td>
                    <td className="p-4 border-b border-slate-700 font-mono text-emerald-400 font-bold text-lg print:text-black">{ticket.ticketCode}</td>
                    <td className="p-4 border-b border-slate-700 print:text-black">
                      <input 
                        type="text" 
                        placeholder="Enter Name..."
                        defaultValue={ticket.playerName || ''}
                        onBlur={(e) => {
                           if(e.target.value !== ticket.playerName) handleAssignName(ticket.ticketCode, e.target.value);
                        }}
                        className="bg-slate-800 text-white p-2 rounded border border-slate-600 focus:border-emerald-500 outline-none w-full print:bg-transparent print:border-none print:text-black"
                      />
                    </td>
                    <td className="p-4 border-b border-slate-700 text-slate-300 print:text-black">Active</td>
                    <td className="p-4 border-b border-slate-700">
                      {ticket.playerStatus === 'PLAYING' 
                        ? <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold print:text-black print:bg-transparent">Joined</span>
                        : <span className="bg-slate-500/20 text-slate-400 px-3 py-1 rounded-full text-sm font-semibold print:text-black print:bg-transparent">Not Joined</span>
                      }
                    </td>
                    <td className="p-4 border-b border-slate-700 print:hidden">
                      <button onClick={() => copyToClipboard(ticket.ticketCode)} className="text-blue-400 hover:text-blue-300 text-sm font-semibold">Copy</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {viewMode === 'monitor' && (
        <div className="space-y-8">
          <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
            <button onClick={returnToDashboard} className="text-slate-400 hover:text-white transition-colors flex items-center">← Back to Dashboard</button>
            <div className="flex gap-4">
              <button 
                onClick={toggleVoice}
                className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition-all border ${isVoiceEnabled ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
              >
                {isVoiceEnabled ? '🔊 Voice ON' : '🔈 Voice OFF'}
              </button>
              {adminStats?.gameStatus === 'WAITING' && (
                <button onClick={() => executeControl('start')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-bold transition-colors shadow-lg shadow-emerald-500/20">Start Game</button>
              )}
              {adminStats?.gameStatus === 'LIVE' && (
                <button onClick={() => executeControl('pause')} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded font-bold transition-colors shadow-lg shadow-amber-500/20">Pause Game</button>
              )}
              {adminStats?.gameStatus === 'PAUSED' && (
                <button onClick={() => executeControl('resume')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-bold transition-colors shadow-lg shadow-emerald-500/20">Resume Game</button>
              )}
              {(adminStats?.gameStatus === 'LIVE' || adminStats?.gameStatus === 'PAUSED') && (
                <button onClick={() => { if(window.confirm('Are you sure you want to end this game?')) executeControl('end') }} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded font-bold transition-colors shadow-lg shadow-red-500/20">End Game</button>
              )}
              <div className="px-4 py-2 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono flex items-center">
                {adminStats?.gameStatus === 'PAUSED' && <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse"></span>}
                Status: {adminStats?.gameStatus || 'UNKNOWN'}
              </div>
            </div>
          </div>
          
          {adminStats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center justify-center shadow-lg">
                <p className="text-slate-400 uppercase tracking-wider text-sm mb-2">Current Number</p>
                <p className="text-6xl font-black text-blue-500">{adminStats.currentNumber || '-'}</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center justify-center shadow-lg">
                <p className="text-slate-400 uppercase tracking-wider text-sm mb-2">Online Players</p>
                <p className="text-5xl font-black text-emerald-500">{adminStats.onlineCount || 0} <span className="text-2xl text-slate-500">/ {adminStats.totalJoined || liveSession.totalPlayers}</span></p>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center justify-center shadow-lg">
                <p className="text-slate-400 uppercase tracking-wider text-sm mb-2">Remaining Nums</p>
                <p className="text-5xl font-black text-amber-500">{adminStats.remainingNumbers !== undefined ? adminStats.remainingNumbers : 90}</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col shadow-lg overflow-y-auto max-h-64">
                <p className="text-slate-400 uppercase tracking-wider text-sm mb-4 text-center sticky top-0 bg-slate-800 pb-2 z-10">Configured Prizes</p>
                <div className="space-y-4">
                  {(adminStats?.prizes || []).map(prize => {
                    return (
                      <div key={prize.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`font-bold ${prize.status === 'COMPLETED' ? 'text-emerald-400' : prize.status === 'AVAILABLE' ? 'text-blue-400' : 'text-slate-500'}`}>{prize.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-800 px-1 py-0.5 rounded">{prize.status}</span>
                        </div>
                        {prize.status === 'COMPLETED' ? (
                           <div className="text-sm text-slate-300">
                             <p>Winner: <strong className="text-white">{prize.winner}</strong></p>
                             <p className="text-xs text-slate-400">Ticket: {prize.winnerTicket}</p>
                           </div>
                        ) : (
                           <p className="text-slate-500 italic text-sm">Waiting...</p>
                        )}
                      </div>
                    );
                  })}
                  {(!adminStats?.prizes || adminStats.prizes.length === 0) && (
                      <p className="text-slate-500 text-sm text-center">No prizes configured.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
             <p className="text-emerald-400 animate-pulse">Connecting to Live Session...</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
               <h2 className="text-xl text-slate-300 mb-6 font-semibold uppercase tracking-widest">Draw History</h2>
               <div className="grid grid-cols-10 gap-2 sm:gap-3">
                 {Array.from({length: 90}, (_, i) => i + 1).map(num => {
                   const isDrawn = adminStats?.drawnNumbers?.includes(num);
                   return (
                     <div 
                       key={num}
                       className={`flex items-center justify-center p-2 rounded text-sm sm:text-base font-bold transition-all duration-500
                         ${isDrawn ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.8)] border border-blue-400' : 'bg-slate-900 text-slate-600 border border-slate-800'}
                       `}
                     >
                       {num}
                     </div>
                   );
                 })}
               </div>
            </div>

            <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700 flex flex-col">
               <h2 className="text-xl text-slate-300 mb-6 font-semibold uppercase tracking-widest flex items-center">
                 <span className="w-2 h-2 rounded-full bg-red-500 mr-3 animate-pulse"></span>
                 Live Activity Feed
               </h2>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[400px]">
                 {(Array.isArray(activityFeed) ? activityFeed : []).length > 0 ? (
                   (Array.isArray(activityFeed) ? activityFeed : []).map((feed, idx) => (
                     <div key={idx} className="bg-slate-900 p-3 rounded-xl border border-slate-700 shadow-sm animate-fade-in-up">
                       <span className="text-xs text-slate-500 font-mono block mb-1">
                         {feed.time.toLocaleTimeString()}
                       </span>
                       <span className="text-slate-300">
                         {feed.message}
                       </span>
                     </div>
                   ))
                 ) : (
                   <div className="text-slate-500 italic text-center mt-10">Waiting for activity...</div>
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
