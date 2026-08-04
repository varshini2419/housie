import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

const FloatingInput = ({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  onBlur,
  icon: Icon,
  error,
  isValid = false,
  required = false,
  autoComplete = 'off',
  disabled = false,
  maxLength,
  placeholder = ' ',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const hasValue = value !== undefined && value !== null && value.toString().length > 0;
  const isFloated = isFocused || hasValue;

  return (
    <div className="w-full text-left">
      <div
        className={`relative w-full h-[54px] rounded-[14px] bg-[#F8FAFC] dark:bg-slate-900/60 border transition-all duration-300 ease-out flex items-center px-4 cursor-text ${
          error
            ? 'border-red-500 ring-2 ring-red-500/15'
            : isFocused
            ? 'border-[#6366F1] ring-4 ring-[#6366F1]/15 shadow-sm bg-white dark:bg-slate-900'
            : 'border-[#E2E8F0] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        {/* Left Field Icon */}
        {Icon && (
          <div className="mr-3 text-slate-400 dark:text-slate-500 transition-colors duration-200 shrink-0">
            <Icon className={`w-5 h-5 ${isFocused ? 'text-[#6366F1]' : ''}`} />
          </div>
        )}

        {/* Input & Floating Label Container */}
        <div className="relative flex-1 h-full flex items-center">
          <input
            id={id || name}
            name={name}
            type={inputType}
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              setIsFocused(false);
              if (onBlur) onBlur(e);
            }}
            disabled={disabled}
            maxLength={maxLength}
            required={required}
            autoComplete={autoComplete}
            placeholder={placeholder}
            className="w-full h-full pt-4 pb-1 bg-transparent text-[16px] text-[#0F172A] dark:text-slate-100 font-medium focus:outline-none placeholder-transparent disabled:opacity-50"
          />

          {/* Floating Label */}
          <label
            htmlFor={id || name}
            className={`absolute left-0 pointer-events-none transition-all duration-200 ease-out font-medium select-none ${
              isFloated
                ? '-top-0.5 text-[11px] font-semibold text-[#6366F1] dark:text-indigo-400 tracking-wide'
                : 'top-1/2 -translate-y-1/2 text-[15px] text-[#64748B] dark:text-slate-400'
            }`}
          >
            {label}
          </label>
        </div>

        {/* Right Status / Action Icons */}
        <div className="ml-2 flex items-center gap-2 shrink-0">
          {/* Password Toggle Button */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer rounded-lg focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Validated Checkmark Icon */}
          {isValid && !error && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </motion.div>
          )}

          {/* Error Warning Icon */}
          {error && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Inline Error Message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 ml-1 text-[13px] font-medium text-[#EF4444] flex items-center gap-1.5"
          >
            <span>{error}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingInput;
