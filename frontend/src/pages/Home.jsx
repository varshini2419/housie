import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Lock, ArrowRight, ShieldCheck, Gamepad2, HelpCircle } from 'lucide-react';
import useGameStore from '../store/useGameStore';
import useSpeech from '../hooks/useSpeech';
import AuthLayout from '../components/auth/AuthLayout';
import FloatingInput from '../components/auth/FloatingInput';
import CustomSessionSelect from '../components/auth/CustomSessionSelect';

const Home = () => {
  const { unlockAudio } = useSpeech();
  const [sessions, setSessions] = useState([]);
  const [formData, setFormData] = useState({
    sessionId: '',
    mobile: ''
  });
  const [rememberMe, setRememberMe] = useState(true);
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
    if (error) setError('');
  };

  const handleSessionChange = (sessionId) => {
    setFormData(prev => ({ ...prev, sessionId }));
    if (error) setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    unlockAudio();

    if (!formData.sessionId) {
      setError('Please select an active session.');
      return;
    }
    if (!formData.mobile) {
      setError('Please enter your mobile number or ticket code.');
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
        throw new Error(data.message || 'Failed to sign in. Please check your details.');
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

  // Validation status helpers
  const isMobileValid = formData.mobile.trim().length >= 4;

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full auth-glass-card p-7 sm:p-8 relative overflow-hidden"
      >
        {/* Top Decorative Gradient Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-1 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-pink-500 rounded-b-full shadow-sm" />

        {/* Animated App Logo Area */}
        <div className="flex flex-col items-center text-center mb-6">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] p-0.5 shadow-lg shadow-indigo-500/25 mb-3 flex items-center justify-center cursor-pointer"
          >
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Gamepad2 className="w-7 h-7 text-[#6366F1]" />
            </div>
          </motion.div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            Welcome Back
          </h1>
          <p className="text-sm font-medium text-[#64748B] dark:text-slate-400 mt-1">
            Sign in to continue to your game
          </p>
        </div>

        {/* Global Error Notice */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-[#EF4444] px-4 py-3 rounded-xl mb-5 text-sm font-medium flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Custom Session Dropdown */}
          <CustomSessionSelect
            sessions={sessions}
            value={formData.sessionId}
            onChange={handleSessionChange}
            label="Choose Active Session"
          />

          {/* Mobile Number / Ticket Input */}
          <FloatingInput
            id="mobile"
            name="mobile"
            type="text"
            label="Mobile Number / Password"
            value={formData.mobile}
            onChange={handleChange}
            icon={Phone}
            isValid={isMobileValid}
            required
            autoComplete="username"
          />

          {/* Remember Me & Help Links */}
          <div className="flex items-center justify-between text-xs font-medium pt-1 px-1">
            <label className="flex items-center gap-2 cursor-pointer text-[#64748B] dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#6366F1] focus:ring-[#6366F1]/30 cursor-pointer accent-[#6366F1]"
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => alert('Contact your host or admin to retrieve your ticket details!')}
              className="text-[#6366F1] dark:text-indigo-400 hover:text-[#4F46E5] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Need help?</span>
            </button>
          </div>

          {/* Full Width Primary CTA Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-[54px] rounded-[16px] bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-[16px] shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-3"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing In...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </motion.button>
        </form>

        {/* Register / Login Switch Link */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-sm font-medium text-[#64748B] dark:text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-[#8B5CF6] dark:text-purple-400 font-semibold hover:underline transition-all inline-flex items-center gap-1 group ml-1"
            >
              <span>Register</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  );
};

export default Home;
