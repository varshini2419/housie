import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone } from 'lucide-react';
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
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-28 -left-28 w-80 h-80 rounded-full bg-brand-primary/15 blur-[90px]"></div>
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-brand-accent/15 blur-[90px]"></div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-brand-border/70 bg-white/80 text-sm font-semibold tracking-[0.22em] text-brand-primary shadow-sm">
            ✨ NEW PLAYER
          </div>
          <h1 className="mt-6 text-5xl sm:text-5xl font-extrabold tracking-tight text-slate-950 drop-shadow-[0_25px_45px_rgba(15,23,42,0.08)]">
            PLAYER REGISTRATION
          </h1>
        </div>

        <div className="glass-panel auth-card p-8 sm:p-10 mx-auto">
          {error && (
            <div className="alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-3">
              <label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Full Name
              </label>
              <div className="input-group">
                <User className="input-icon" />
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Kumar"
                  className="input-field pl-12"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Email
              </label>
              <div className="input-group">
                <Mail className="input-icon" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. rahul@gmail.com"
                  className="input-field pl-12"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="mobile" className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Mobile Number
              </label>
              <div className="input-group">
                <Phone className="input-icon" />
                <input
                  id="mobile"
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  className="input-field pl-12"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="primary-action-btn w-full"
            >
              {loading ? 'Registering...' : 'REGISTER'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            <Link to="/" className="font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors">
              Already registered? LOGIN HERE
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
