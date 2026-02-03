
import React, { useMemo } from 'react';

interface JarvisCoreProps {
  isProcessing: boolean;
  isSpeaking?: boolean;
}

export const JarvisCore: React.FC<JarvisCoreProps> = ({ isProcessing, isSpeaking }) => {
  const webElements = useMemo(() => {
    const lines = Array.from({ length: 50 }).map((_, i) => ({
      x1: Math.random() * 100,
      y1: Math.random() * 100,
      x2: Math.random() * 100,
      y2: Math.random() * 100,
      opacity: 0.05 + Math.random() * 0.4,
      duration: 3 + Math.random() * 5
    }));
    const dots = Array.from({ length: 80 }).map((_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * 1.5,
      opacity: 0.1 + Math.random() * 0.8,
      delay: Math.random() * 4
    }));
    return { lines, dots };
  }, []);

  return (
    <div className="relative w-72 h-72 sm:w-96 sm:h-96 md:w-[32rem] md:h-[32rem] flex items-center justify-center float">
      {/* Background Energy Halo */}
      <div className={`absolute inset-0 rounded-full bg-amber-600/5 blur-[80px] transition-opacity duration-1000 ${isProcessing || isSpeaking ? 'opacity-100' : 'opacity-30'}`}></div>

      {/* Layer 1: The Neural Net */}
      <svg className={`absolute inset-0 w-full h-full opacity-30 ${isProcessing ? 'animate-spin-slower' : 'animate-spin-super-slow'}`} viewBox="0 0 100 100">
        <defs>
          <radialGradient id="lineGradAmber" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
          </radialGradient>
        </defs>
        {webElements.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="url(#lineGradAmber)" strokeWidth="0.05" strokeOpacity={l.opacity} />
        ))}
      </svg>

      {/* Layer 2: Core Geometric Rings */}
      <div className={`absolute inset-0 border border-amber-500/5 rounded-full scale-110 ${isProcessing ? 'animate-spin-slow' : 'opacity-20'}`}></div>
      <div className={`absolute inset-4 border border-dashed border-amber-600/10 rounded-full scale-105 ${isProcessing ? 'animate-reverse-spin-slow' : 'opacity-10'}`}></div>

      {/* Layer 3: Active Data Nodes */}
      <svg className={`absolute inset-0 w-full h-full ${isProcessing || isSpeaking ? 'animate-pulse' : ''}`} viewBox="0 0 100 100">
        {webElements.dots.map((d, i) => (
          <circle 
            key={i} 
            cx={d.x} 
            cy={d.y} 
            r={d.size} 
            fill="#fbbf24" 
            style={{ animationDelay: `${d.delay}s`, opacity: isSpeaking ? d.opacity * 1.2 : d.opacity }} 
          />
        ))}
      </svg>

      {/* Central Command Hub */}
      <div className={`relative z-10 w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center`}>
        {/* Glow Foundation */}
        <div className={`absolute inset-0 bg-gradient-to-tr from-amber-600/20 via-orange-400/5 to-transparent rounded-full blur-2xl animate-pulse`}></div>
        
        {/* Main Interface Unit */}
        <div className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#0a0501] border-2 border-amber-500/50 flex items-center justify-center shadow-[0_0_80px_rgba(245,158,11,0.3)] transition-transform duration-500 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.8)] transition-all duration-300 ${isSpeaking ? 'scale-125 brightness-125 shadow-[0_0_60px_rgba(251,191,36,1)]' : ''}`}></div>
          
          {/* Internal Rings */}
          <div className="absolute inset-2 border border-amber-500/20 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
          <div className="absolute inset-4 border border-dotted border-amber-600/30 rounded-full animate-reverse-spin" style={{ animationDuration: '6s' }}></div>

          {/* Sensory Spikes */}
          {[...Array(12)].map((_, i) => (
            <div 
              key={i}
              className={`absolute w-[2px] bg-gradient-to-t from-amber-500 to-transparent transition-all duration-300`}
              style={{ 
                height: isSpeaking ? '60px' : '30px',
                transform: `rotate(${i * 30}deg) translateY(-20px)`,
                opacity: isSpeaking ? 0.8 : 0.2
              }}
            ></div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin-super-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-super-slow { animation: spin-super-slow 120s linear infinite; }
        
        @keyframes spin-slower { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slower { animation: spin-slower 40s linear infinite; }

        @keyframes reverse-spin-slow { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-reverse-spin-slow { animation: reverse-spin-slow 20s linear infinite; }
      `}</style>
    </div>
  );
};
