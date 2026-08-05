import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import ThemeToggle from '../components/ThemeToggle';

const Home = () => {
  const { unlockAudio } = useSpeech();
  const [sessions, setSessions] = useState([]);
  const [formData, setFormData] = useState({
    sessionId: '',
    mobile: ''
  });
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    unlockAudio();
    
    if (!formData.sessionId || !formData.mobile) {
      setError('Please select a session and enter your mobile number.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/player/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            sessionId: formData.sessionId, 
            mobile: formData.mobile 
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to login');
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg relative overflow-hidden px-4">
      {/* Ambient background glow orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge"></div>
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge"></div>

      <div className="absolute top-8 right-8 z-20">
        <ThemeToggle />
      </div>

      <div className="text-center mb-10 z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
          ✨ Live Multiplayer Tambola
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tight">
          JOIN GAME
        </h1>
      </div>

      <div className="glass-panel p-8 w-full max-w-md relative z-10 transition-all duration-300">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-b-full"></div>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3.5 rounded-2xl mb-5 text-sm font-medium text-center animate-shake">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">
              Select Session
            </label>
            <select
              name="sessionId"
              value={formData.sessionId}
              onChange={handleChange}
              className="w-full premium-input appearance-none cursor-pointer"
            >
              <option value="" className="bg-brand-card">-- Choose Active Session --</option>
              {sessions.map(session => (
                <option key={session._id} value={session._id} className="bg-brand-card text-brand-text">
                  {session.sessionName} ({new Date(session.startTime).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1.5 ml-1">
              Mobile Number (Password)
            </label>
            <input 
              type="tel" 
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="Your Registered Mobile" 
              className="w-full premium-input text-lg tracking-wide"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-6 premium-btn-primary text-lg"
          >
            {loading ? 'Logging In...' : 'JOIN NOW'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-brand-border">
          <p className="text-sm text-brand-text-muted mb-2">Not yet registered?</p>
          <Link to="/register" className="text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors uppercase tracking-wider">
            Register Here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
