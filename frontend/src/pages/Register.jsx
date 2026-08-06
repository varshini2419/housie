import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.mobile) {
      setError('Please fill all fields.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:5000')}/api/player/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to register');
      }

      alert('Successfully Registered. Redirecting to Login...');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden auth-page px-4 py-10 text-[#0F172A]">
      <div className="pointer-events-none absolute -top-28 -left-24 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 bg-blue-200/15 rounded-full blur-3xl"></div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/90 to-transparent"></div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center justify-center text-center">
        <div className="auth-badge mb-5">✨ Live Multiplayer Housie</div>
        <h1 className="auth-headline">PLAYER REGISTRATION</h1>
        <p className="auth-subtitle">
          Create your account to join games instantly and play from any device.
        </p>
      </div>

      <div className="relative z-10 mx-auto mt-12 w-full max-w-xl auth-card glass-panel p-8 sm:p-10">
        <div className="auth-card-line" aria-hidden="true" />

        {error && (
          <div className="auth-error mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label htmlFor="fullName" className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 mb-2">
              Full Name
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Rahul Kumar"
                className="auth-input pl-14"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 mb-2">
              Email
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. rahul@gmail.com"
                className="auth-input pl-14"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mobile" className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 mb-2">
              Mobile Number
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.18A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.12.81.32 1.6.6 2.36a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.72-1.06a2 2 0 0 1 2.11-.45c.76.28 1.55.48 2.36.6A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <input
                id="mobile"
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                className="auth-input pl-14"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-primary text-lg"
          >
            {loading ? 'Registering...' : 'REGISTER'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <div className="auth-divider mb-6" />
          <Link to="/" className="auth-link">
            ALREADY REGISTERED? LOGIN HERE
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
