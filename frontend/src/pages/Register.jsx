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
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg relative overflow-hidden px-4 py-12">
      {/* Ambient background glow orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge"></div>
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl mix-blend-screen dark:mix-blend-color-dodge"></div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="text-center mb-8 z-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tight">
          Player Registration
        </h1>
      </div>

      <div className="glass-panel p-6 sm:p-8 w-full max-w-md relative z-10 border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-3xl transition-all duration-300">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-b-full"></div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3.5 rounded-2xl mb-5 text-sm font-semibold text-center animate-shake">
            {error}
          </div>
        )}
        
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Full Name
            </label>
            <input 
              type="text" 
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="e.g. Rahul Kumar" 
              className="w-full premium-input font-medium tracking-wide"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Email
            </label>
            <input 
              type="email" 
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. rahul@gmail.com" 
              className="w-full premium-input font-medium tracking-wide"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Mobile Number
            </label>
            <input 
              type="tel" 
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="e.g. 9876543210" 
              className="w-full premium-input font-medium tracking-wide"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-6 premium-btn-primary text-base font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
          >
            {loading ? 'Registering...' : 'REGISTER'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-slate-200/80 dark:border-slate-800">
          <Link to="/" className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider">
            Already registered? Login Here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
