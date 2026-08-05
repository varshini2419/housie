import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, EyeOff, ChevronDown } from 'lucide-react';
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
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-28 -left-28 w-80 h-80 rounded-full bg-brand-primary/15 blur-[90px]"></div>
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-brand-accent/15 blur-[90px]"></div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-brand-border/70 bg-white/80 text-sm font-semibold tracking-[0.22em] text-brand-primary shadow-sm">
            ✨ LIVE MULTIPLAYER HOUSIE
          </div>
          <h1 className="mt-6 text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-950 drop-shadow-[0_25px_45px_rgba(15,23,42,0.08)]">
            JOIN GAME
          </h1>
        </div>

        <div className="glass-panel auth-card p-8 sm:p-10 mx-auto">
          {error && (
            <div className="alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-3">
              <label htmlFor="sessionId" className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Select Session
              </label>
              <div className="input-group">
                <select
                  id="sessionId"
                  name="sessionId"
                  value={formData.sessionId}
                  onChange={handleChange}
                  className="input-field appearance-none"
                >
                  <option value="">-- Choose Active Session --</option>
                  {sessions.map(session => (
                    <option key={session._id} value={session._id}>
                      {session.sessionName} ({new Date(session.startTime).toLocaleDateString()})
                    </option>
                  ))}
                </select>
                <ChevronDown className="input-icon-right" />
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="mobile" className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Mobile Number (Password)
              </label>
              <div className="input-group">
                <Phone className="input-icon" />
                <input
                  id="mobile"
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  placeholder="Your Registered Mobile"
                  className="input-field pl-12"
                />
                <EyeOff className="input-icon-right" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="primary-action-btn w-full"
            >
              {loading ? 'Logging In...' : 'JOIN NOW'}
            </button>
          </form>

          <div className="mt-8">
            <div className="divider" />
            <div className="mt-5 text-center text-sm text-slate-500">
              Not yet registered?{' '}
              <Link to="/register" className="font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors">
                REGISTER HERE
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
