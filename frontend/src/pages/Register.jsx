import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, ArrowRight, ShieldCheck, UserPlus } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import FloatingInput from '../components/auth/FloatingInput';

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
    if (error) setError('');
  };

  // Field validation helpers
  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

  const isNameValid = formData.fullName.trim().length >= 2;
  const isEmailValid = Boolean(validateEmail(formData.email));
  const isMobileValid = formData.mobile.trim().length >= 8;

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!formData.email.trim() || !isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!formData.mobile.trim() || !isMobileValid) {
      setError('Please enter a valid mobile number.');
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
        throw new Error(data.message || 'Failed to complete registration.');
      }

      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            whileHover={{ scale: 1.05, rotate: -5 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] p-0.5 shadow-lg shadow-indigo-500/25 mb-3 flex items-center justify-center cursor-pointer"
          >
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
              <UserPlus className="w-7 h-7 text-[#6366F1]" />
            </div>
          </motion.div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            Create Account
          </h1>
          <p className="text-sm font-medium text-[#64748B] dark:text-slate-400 mt-1">
            Enter your details to get started
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

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name */}
          <FloatingInput
            id="fullName"
            name="fullName"
            type="text"
            label="Full Name"
            value={formData.fullName}
            onChange={handleChange}
            icon={User}
            isValid={isNameValid}
            required
            autoComplete="name"
          />

          {/* Email */}
          <FloatingInput
            id="email"
            name="email"
            type="email"
            label="Email Address"
            value={formData.email}
            onChange={handleChange}
            icon={Mail}
            isValid={isEmailValid}
            required
            autoComplete="email"
          />

          {/* Mobile Number */}
          <FloatingInput
            id="mobile"
            name="mobile"
            type="tel"
            label="Mobile Number"
            value={formData.mobile}
            onChange={handleChange}
            icon={Phone}
            isValid={isMobileValid}
            required
            autoComplete="tel"
          />

          {/* Full Width Primary CTA Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-[54px] rounded-[16px] bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-[16px] shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Account...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </motion.button>
        </form>

        {/* Register / Login Switch Link */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-sm font-medium text-[#64748B] dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/"
              className="text-[#8B5CF6] dark:text-purple-400 font-semibold hover:underline transition-all inline-flex items-center gap-1 group ml-1"
            >
              <span>Sign in</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  );
};

export default Register;
