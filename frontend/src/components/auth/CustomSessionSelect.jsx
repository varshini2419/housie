import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Target, Sparkles, Check } from 'lucide-react';

const CustomSessionSelect = ({
  sessions = [],
  value,
  onChange,
  error,
  label = "Select Active Session",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedSession = sessions.find(s => s._id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div className="w-full text-left relative" ref={dropdownRef}>
      {/* Dropdown Control Container */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full h-[54px] rounded-[14px] bg-[#F8FAFC] dark:bg-slate-900/60 border transition-all duration-300 ease-out flex items-center px-4 cursor-pointer select-none ${
          error
            ? 'border-red-500 ring-2 ring-red-500/15'
            : isOpen
            ? 'border-[#6366F1] ring-4 ring-[#6366F1]/15 shadow-md bg-white dark:bg-slate-900'
            : 'border-[#E2E8F0] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {/* Target Icon */}
        <div className="mr-3 text-slate-400 dark:text-slate-500 shrink-0">
          <Target className={`w-5 h-5 ${isOpen ? 'text-[#6366F1]' : ''}`} />
        </div>

        {/* Selected Label or Placeholder */}
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
          <span className="text-[11px] font-semibold text-[#6366F1] dark:text-indigo-400 tracking-wide uppercase">
            Active Session
          </span>
          <span className="text-[15px] font-medium text-[#0F172A] dark:text-slate-100 truncate">
            {selectedSession ? selectedSession.sessionName : label}
          </span>
        </div>

        {/* Right Session Badge & Chevron */}
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {sessions.length > 0 && !selectedSession && (
            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {sessions.length} Active
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${
              isOpen ? 'rotate-180 text-[#6366F1]' : ''
            }`}
          />
        </div>
      </div>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[60px] left-0 w-full z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[16px] shadow-2xl p-1.5 overflow-hidden max-h-60 overflow-y-auto"
          >
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                No active sessions available right now.
              </div>
            ) : (
              sessions.map((session) => {
                const isSelected = session._id === value;
                return (
                  <button
                    key={session._id}
                    type="button"
                    onClick={() => handleSelect(session._id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[12px] transition-all flex items-center justify-between text-sm cursor-pointer mb-1 last:mb-0 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-indigo-400 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-medium'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>{session.sessionName}</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                        Started: {new Date(session.startTime).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Live
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#6366F1]" />}
                    </div>
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error text if any */}
      {error && (
        <p className="mt-1.5 ml-1 text-[13px] font-medium text-[#EF4444]">
          {error}
        </p>
      )}
    </div>
  );
};

export default CustomSessionSelect;
