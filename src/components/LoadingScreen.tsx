import React from 'react';

export const LoadingScreen: React.FC<{ message?: string }> = ({
  message = 'Authenticating with Basechan CMS...',
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />

      {/* Subtle Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-6 max-w-sm w-full text-center">
        {/* Animated Glowing Logo Container */}
        <div className="relative flex items-center justify-center">
          {/* Outer Animated Spinning Ring */}
          <div className="w-24 h-24 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 border-r-amber-400 animate-spin" style={{ animationDuration: '1.2s' }} />

          {/* Inner Pulsing Ring */}
          <div className="absolute inset-2 rounded-full border border-indigo-500/30 animate-ping opacity-30" />

          {/* Central Logo */}
          <div className="absolute p-1 bg-slate-900 rounded-full border border-amber-400/40 shadow-xl shadow-amber-500/10">
            <img
              src="/logo.png"
              alt="Basechan Logo"
              className="w-12 h-12 rounded-full object-cover shadow-inner"
            />
          </div>
        </div>

        {/* Branding & Status Indicator */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white tracking-wide">Basechan CMS</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-xs text-slate-400 font-mono tracking-tight">{message}</p>
          </div>
        </div>

        {/* Shimmer Progress Line */}
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
          <div className="absolute inset-y-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-indigo-500 w-1/2 rounded-full animate-shimmer" style={{ animation: 'shimmer 1.5s infinite' }} />
        </div>
      </div>
    </div>
  );
};
