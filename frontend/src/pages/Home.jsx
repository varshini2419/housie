import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../store/useGameStore';

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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/player/sessions`);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/player/join`, {
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900">
      <h1 className="text-5xl font-bold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
        Tambola Live
      </h1>
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl shadow-blue-500/10 w-96 border border-slate-700">
        <h2 className="text-2xl mb-6 font-semibold text-center text-slate-100">Join a Game</h2>
        
        {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4 text-sm text-center">{error}</div>}
        
        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-white mb-4 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
        >
          <option value="">-- Select Session --</option>
          {sessions.map(session => (
            <option key={session._id} value={session._id}>
              {session.sessionName} ({new Date(session.startTime).toLocaleDateString()})
            </option>
          ))}
        </select>
        
        <input 
          type="text" 
          value={ticketCode}
          onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
          placeholder="Enter your Ticket Code" 
          className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-white mb-6 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center text-xl uppercase transition-all"
        />
        <button 
          onClick={handleJoin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Join Game'}
        </button>
      </div>
    </div>
  );
};

export default Home;
