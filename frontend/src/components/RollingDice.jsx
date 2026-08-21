import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 3D Rolling Dice component for Online Housie game number announcements.
 * 
 * - Receives `finalNumber` from authoritative game logic.
 * - Rotates in 3D for ~1000ms while intermediate numbers roll across visible faces.
 * - Settles smoothly on the front face displaying `finalNumber`.
 * - Triggers subtle bounce & confetti landing effect.
 */
export default function RollingDice({ finalNumber, isLive = false, size = "desktop" }) {
  const [displayedNumber, setDisplayedNumber] = useState(finalNumber);
  const [isRolling, setIsRolling] = useState(false);
  const [isLanded, setIsLanded] = useState(false);

  // Cumulative 3D rotation angles (multiples of 360 ensure front face lands forward)
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

  // Face numbers displayed during animation
  const [faceNumbers, setFaceNumbers] = useState({
    front: finalNumber || '-',
    back: 42,
    top: 17,
    bottom: 88,
    left: 63,
    right: 29
  });

  const prevFinalNumberRef = useRef(finalNumber);
  const rollCountRef = useRef(0);
  const isFirstMountRef = useRef(true);

  // Cube dimensions based on size prop
  const cubeDimension = size === "mobile" ? 132 : 148;
  const halfSize = cubeDimension / 2;
  const containerClass = size === "mobile" ? "w-40 h-40" : "w-44 h-44";
  const fontClass = size === "mobile" ? "text-6xl" : "text-7xl";

  useEffect(() => {
    // Skip animation on initial mount if finalNumber is null or initial
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevFinalNumberRef.current = finalNumber;
      setDisplayedNumber(finalNumber);
      setFaceNumbers(prev => ({ ...prev, front: finalNumber || '-' }));
      return;
    }

    // Trigger 3D dice roll when finalNumber changes and is not null
    if (finalNumber !== prevFinalNumberRef.current && finalNumber !== null && finalNumber !== undefined) {
      prevFinalNumberRef.current = finalNumber;
      triggerRollAnimation(finalNumber);
    } else if (finalNumber === null) {
      prevFinalNumberRef.current = null;
      setDisplayedNumber(null);
      setFaceNumbers(prev => ({ ...prev, front: '-' }));
    }
  }, [finalNumber]);

  const triggerRollAnimation = (targetNumber) => {
    setIsRolling(true);
    setIsLanded(false);

    rollCountRef.current += 1;
    const count = rollCountRef.current;

    // Gentle, ultra-slow 360-degree 3D rotation (1 single turn over 2.2s)
    const targetX = count * 360;
    const targetY = count * 360;
    const targetZ = 0;

    setRotation({ x: targetX, y: targetY, z: targetZ });

    // Generate random 1-90 intermediate numbers at a very slow 260ms pace for side faces
    const interval = setInterval(() => {
      setFaceNumbers({
        back: Math.floor(Math.random() * 90) + 1,
        top: Math.floor(Math.random() * 90) + 1,
        bottom: Math.floor(Math.random() * 90) + 1,
        left: Math.floor(Math.random() * 90) + 1,
        right: Math.floor(Math.random() * 90) + 1,
      });
    }, 260);

    // At 2200ms finish rotation, set landed state and trigger bounce & confetti
    const finishTimeout = setTimeout(() => {
      clearInterval(interval);
      setIsRolling(false);
      setDisplayedNumber(targetNumber);
      setIsLanded(true);

      // Reset landed animation flag after bounce finishes
      setTimeout(() => setIsLanded(false), 600);
    }, 2200);

    return () => {
      clearInterval(interval);
      clearTimeout(finishTimeout);
    };
  };

  // Render individual face of 3D cube with sharp, crisp physical cube edges
  const renderFace = (faceKey, transformStyle, numValue) => (
    <div
      key={faceKey}
      className="dice-face flex flex-col items-center justify-between p-3 rounded-sm bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white via-slate-50 to-blue-50/30 border-[3.5px] border-white/95 ring-1 ring-blue-500/20 shadow-[inset_0_3px_6px_rgba(255,255,255,1),inset_0_-4px_12px_rgba(15,23,42,0.06),0_16px_36px_rgba(15,23,42,0.12),0_0_20px_rgba(79,142,247,0.15)] select-none overflow-hidden"
      style={{ transform: transformStyle }}
    >
      {/* Top micro-dot pips with glowing gradient */}
      <div className="w-full flex justify-between items-center px-1 pt-0.5">
        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]"></span>
        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]"></span>
      </div>

      {/* Center Number with crisp drop shadow */}
      <div className="flex-1 flex items-center justify-center -mt-1">
        <span className={`${fontClass} font-black text-[#0F172A] tracking-tighter leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.08)]`}>
          {numValue !== null && numValue !== undefined ? numValue : '-'}
        </span>
      </div>

      {/* Bottom Subtitle / Branding Pill Badge */}
      <div className="px-2.5 py-0.5 mb-0.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 shadow-sm flex items-center gap-1.5 opacity-95">
        <span className="text-[9.5px] font-black text-[#2563EB] tracking-wider uppercase">
          BHIMAVARAM ONLINE
        </span>
        <span className="text-[10px]">✨</span>
      </div>
    </div>
  );

  return (
    <div className={`relative flex items-center justify-center ${containerClass} dice-perspective`}>
      {/* Ground Shadow */}
      <div 
        className="absolute -bottom-4 w-3/4 h-6 dice-ground-shadow rounded-full transition-all duration-400 pointer-events-none"
        style={{
          transform: isRolling ? 'scale(0.85)' : isLanded ? 'scale(1.2)' : 'scale(1)',
          opacity: isRolling ? 0.3 : isLanded ? 0.65 : 0.45
        }}
      />

      {/* Confetti Particles on Landing */}
      <AnimatePresence>
        {isLanded && (
          <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
            {[...Array(14)].map((_, i) => {
              const angle = (i / 14) * Math.PI * 2;
              const distance = 75 + (i % 3) * 16;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              const colors = ['#4F8EF7', '#00C16E', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6'];
              const bg = colors[i % colors.length];

              return (
                <motion.div
                  key={`confetti-${i}`}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{ 
                    x: x, 
                    y: y, 
                    scale: [1, 1.3, 0], 
                    opacity: [1, 1, 0],
                    rotate: i * 45 
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute w-2.5 h-2.5 rounded-sm shadow-sm"
                  style={{ backgroundColor: bg }}
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* 3D Rolling Cube Container */}
      <motion.div
        animate={{
          rotateX: rotation.x,
          rotateY: rotation.y,
          rotateZ: rotation.z,
          scale: isLanded ? [1, 1.12, 0.94, 1] : 1
        }}
        transition={{
          rotateX: { duration: 2.2, ease: [0.16, 1, 0.3, 1] },
          rotateY: { duration: 2.2, ease: [0.16, 1, 0.3, 1] },
          rotateZ: { duration: 2.2, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 0.4, ease: "easeInOut" }
        }}
        className={`relative dice-cube-container ${
          isLive ? "shadow-[0_0_60px_rgba(59,130,246,0.3)]" : ""
        }`}
        style={{
          width: `${cubeDimension}px`,
          height: `${cubeDimension}px`,
          transformStyle: 'preserve-3d'
        }}
      >
        {/* 6 Cube Faces */}
        {renderFace('front', `rotateY(0deg) translateZ(${halfSize}px)`, finalNumber || '-')}
        {renderFace('back', `rotateY(180deg) translateZ(${halfSize}px)`, faceNumbers.back)}
        {renderFace('right', `rotateY(90deg) translateZ(${halfSize}px)`, faceNumbers.right)}
        {renderFace('left', `rotateY(-90deg) translateZ(${halfSize}px)`, faceNumbers.left)}
        {renderFace('top', `rotateX(90deg) translateZ(${halfSize}px)`, faceNumbers.top)}
        {renderFace('bottom', `rotateX(-90deg) translateZ(${halfSize}px)`, faceNumbers.bottom)}
      </motion.div>
    </div>
  );
}
