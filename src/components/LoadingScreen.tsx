import React, { useState, useEffect } from 'react';

const PROGRESSIVE_MESSAGES = [
  'Loading Basechan CMS...',
  'Preparing your portal...',
  'We are almost ready...',
  'Sorry, this is taking a moment...',
  'Finishing up setup...',
];

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  const [messageIndex, setMessageIndex] = useState<number>(0);

  // Rotate loading text every 5 seconds (5000ms)
  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROGRESSIVE_MESSAGES.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#18181B] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />

      {/* Subtle Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-5 max-w-sm w-full text-center">
        {/* Animated Glowing Logo Container */}
        <div className="relative flex items-center justify-center">
          {/* Outer Animated Spinning Ring */}
          <div
            className="w-24 h-24 rounded-full border-2 border-slate-700 border-t-[#FBBF24] border-r-blue-500 animate-spin"
            style={{ animationDuration: '1.2s' }}
          />

          {/* Inner Pulsing Ring */}
          <div className="absolute inset-2 rounded-full border border-amber-400/30 animate-ping opacity-30" />

          {/* Central Logo */}
          <div className="absolute p-1 bg-[#0E1526] rounded-full border border-[#FBBF24]/40 shadow-xl shadow-amber-500/10">
            <img
              src="/logo.png"
              alt="Basechan Logo"
              className="w-12 h-12 rounded-full object-cover shadow-inner"
            />
          </div>
        </div>

        {/* Branding Title */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-white tracking-tight">Basechan CMS</h2>

          {/* Progressive Rotating Text (Changes every 5s) */}
          <div className="min-h-[24px] flex items-center justify-center">
            <p
              key={messageIndex}
              className="text-xs text-amber-400 font-semibold tracking-tight transition-all duration-300 animate-in fade-in zoom-in-95"
            >
              {message || PROGRESSIVE_MESSAGES[messageIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
