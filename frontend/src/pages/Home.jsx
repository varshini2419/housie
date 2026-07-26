import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../store/useGameStore';

const Home = () => {
  const [ticketCode, setTicketCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession, setTicket } = useGameStore();

  const handleJoin = async () => {
    if (!ticketCode || ticketCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/player/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketCode: ticketCode.toUpperCase() })
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
        
        <input 
          type="text" 
          value={ticketCode}
          onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-digit Code" 
          maxLength={6}
          className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-white mb-6 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center tracking-[0.5em] text-xl uppercase transition-all"
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
