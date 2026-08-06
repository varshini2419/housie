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
    <div className="relative min-h-screen overflow-hidden auth-page px-4 py-10 text-[#0F172A]">
      <div className="pointer-events-none absolute -top-32 -left-28 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-36 -right-24 w-80 h-80 bg-blue-200/15 rounded-full blur-3xl"></div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/90 to-transparent"></div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center justify-center text-center">
        <div className="auth-badge mb-5">✨ Live Multiplayer Housie</div>
        <h1 className="auth-headline">JOIN GAME</h1>
        <p className="auth-subtitle">
          Access your active session and join the live game with your registered mobile number.
        </p>
      </div>

      <div className="relative z-10 mx-auto mt-12 w-full max-w-xl auth-card glass-panel p-8 sm:p-10">
        <div className="auth-card-line" aria-hidden="true" />

        {error && (
          <div className="auth-error mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="sessionId" className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 mb-2">
              Select Session
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M5 12h14" />
                  <path d="M7 18h10" />
                </svg>
              </span>
              <select
                id="sessionId"
                name="sessionId"
                value={formData.sessionId}
                onChange={handleChange}
                className="auth-select pl-14 pr-12"
              >
                <option value="">-- Choose Active Session --</option>
                {sessions.map(session => (
                  <option key={session._id} value={session._id}>
                    {session.sessionName} ({new Date(session.startTime).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <span className="input-icon input-icon-right" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="mobile" className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 mb-2">
              Mobile Number (Password)
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.12.81.32 1.6.6 2.36a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.72-1.06a2 2 0 0 1 2.11-.45c.76.28 1.55.48 2.36.6A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <input
                id="mobile"
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="Your Registered Mobile"
                className="auth-input pl-14"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-primary text-lg"
          >
            {loading ? 'Logging In...' : 'JOIN NOW'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <div className="auth-divider mb-6" />
          <p className="auth-caption mb-3">Not yet registered?</p>
          <Link to="/register" className="auth-link">
            REGISTER HERE
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
