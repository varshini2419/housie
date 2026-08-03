import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../store/useGameStore';
import ThemeToggle from '../components/ThemeToggle';

const Home = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [ticketCode, setTicketCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession, setTicket } = useGameStore();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/player/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const handleJoin = async () => {
    if (!selectedSessionId) {
      setError('Please select a session.');
      return;
    }
    if (!ticketCode) {
      setError('Please enter your Ticket Code.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/player/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSessionId, ticketCode: ticketCode.toUpperCase() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to join game');
      }

      setSession(data.session);
      setTicket(data.ticket);
      navigate(`/game/${data.session.id}`);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg relative overflow-hidden px-4 py-8 select-none">
      {/* Ambient background glow orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge"></div>
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge"></div>
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-full blur-3xl"></div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Header Section */}
      <div className="text-center mb-8 z-10 max-w-lg">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest mb-3 shadow-xs">
          <span>✨</span> LIVE MULTIPLAYER TAMBOLA
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tight leading-tight">
          JOIN GAME
        </h1>
        <p className="text-brand-text-muted mt-2 text-sm sm:text-base max-w-sm mx-auto font-medium">
          Enter your session & ticket code to join the live room in real-time.
        </p>
      </div>

      {/* Main Glassmorphic Join Card */}
      <div className="glass-panel p-6 sm:p-8 w-full max-w-md relative z-10 border border-slate-200/90 dark:border-slate-700/80 rounded-[2.2rem] shadow-[0_20px_60px_rgba(0,0,0,0.07)] backdrop-blur-xl transition-all duration-300">
        
        {/* Top gradient indicator bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-b-full"></div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3.5 rounded-2xl mb-6 text-sm font-semibold text-center animate-shake flex items-center justify-center gap-2 shadow-xs">
            <span>⚠️</span> {error}
          </div>
        )}
        
        <div className="space-y-5">
          {/* Select Session */}
          <div>
            <label className="block text-[11px] font-black text-brand-text-muted uppercase tracking-widest mb-2 ml-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>🎯</span> SELECT SESSION
              </span>
              {sessions.length > 0 && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {sessions.length} Active
                </span>
              )}
            </label>
            
            <div className="relative">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full premium-input appearance-none cursor-pointer pr-10 font-semibold text-sm rounded-2xl border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/30 bg-white/90 dark:bg-slate-900/90"
              >
                <option value="" className="bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white font-medium">
                  -- Choose Active Session --
                </option>
                {sessions.map(session => (
                  <option key={session._id} value={session._id} className="bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white font-medium">
                    {session.sessionName} ({new Date(session.startTime).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
          
          {/* Ticket Code Input */}
          <div>
            <label className="block text-[11px] font-black text-brand-text-muted uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5">
              <span>🎟️</span> TICKET CODE / MOBILE NUMBER
            </label>
            <input 
              type="text" 
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              placeholder="e.g. A102 or Registered Mobile" 
              className="w-full premium-input text-center text-lg tracking-wider uppercase font-mono font-bold rounded-2xl border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/30 bg-white/90 dark:bg-slate-900/90"
            />
          </div>

          {/* Submit Button */}
          <button 
            onClick={handleJoin}
            disabled={loading}
            className="w-full mt-3 premium-btn-primary text-base sm:text-lg font-black tracking-wide py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 active:scale-[0.98] transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Verifying Ticket...
              </span>
            ) : (
              <span>JOIN NOW →</span>
            )}
          </button>

          {/* Footer Registration Info Link */}
          <div className="pt-2 text-center">
            <p className="text-xs text-brand-text-muted font-medium">
              Not yet registered?{' '}
              <button 
                type="button"
                onClick={() => alert("Please contact the host or admin to register and obtain your Ticket Code!")}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold uppercase tracking-wider underline cursor-pointer transition-colors"
              >
                REGISTER HERE
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
