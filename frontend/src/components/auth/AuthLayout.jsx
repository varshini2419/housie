import React from 'react';
import { motion } from 'framer-motion';
import ThemeToggle from '../ThemeToggle';
import { Sparkles } from 'lucide-react';

const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen w-full auth-mesh-bg relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden select-none transition-colors duration-300">
      {/* Floating Animated Gradient Orbs & Blobs */}
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-indigo-400/20 dark:bg-indigo-600/25 rounded-full blur-[100px]"
      />

      <motion.div
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 40, -40, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="pointer-events-none absolute -bottom-24 -right-24 w-[28rem] h-[28rem] bg-purple-400/20 dark:bg-purple-600/25 rounded-full blur-[110px]"
      />

      <motion.div
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-blue-400/10 dark:bg-blue-600/15 rounded-full blur-[120px]"
      />

      {/* Floating Light Particles / Abstract Glow Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/6 w-2 h-2 rounded-full bg-indigo-400/40 blur-xs animate-ping duration-1000" />
        <div className="absolute bottom-1/3 right-1/5 w-3 h-3 rounded-full bg-purple-400/30 blur-xs animate-pulse duration-700" />
        <div className="absolute top-2/3 left-1/4 w-1.5 h-1.5 rounded-full bg-indigo-500/50 blur-2xs animate-pulse" />
      </div>

      {/* Top Header Controls */}
      <div className="absolute top-5 right-5 sm:top-8 sm:right-8 z-30 flex items-center gap-3">
        <ThemeToggle />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[420px] relative z-10 my-auto flex flex-col items-center">
        {children}
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md text-[11px] font-semibold text-slate-500 dark:text-slate-400 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Housie Live Multiplayer</span>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
