
import React, { useMemo, useEffect, useState } from 'react';

interface JarvisCoreProps {
  isProcessing: boolean;
  isSpeaking?: boolean;
}

export const JarvisCore: React.FC<JarvisCoreProps> = ({ isProcessing, isSpeaking }) => {
  const [synapseOffset, setSynapseOffset] = useState(0);

  useEffect(() => {
    let frame: number;
    const animate = () => {
      setSynapseOffset(prev => (prev + 0.5) % 100);
      frame = requestAnimationFrame(animate);
    };
    if (isProcessing || isSpeaking) {
      frame = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(frame);
  }, [isProcessing, isSpeaking]);

  const webElements = useMemo(() => {
    const lines = Array.from({ length: 80 }).map((_, i) => ({
      x1: Math.random() * 100,
      y1: Math.random() * 100,
      x2: Math.random() * 100,
      y2: Math.random() * 100,
      opacity: 0.02 + Math.random() * 0.3,
    }));
    return { lines };
  }, []);

  return (
    <div className="relative w-[30rem] h-[30rem] sm:w-[45rem] sm:h-[45rem] flex items-center justify-center transition-transform duration-1000" style={{ filter: isSpeaking ? 'url(#refraction)' : 'none' }}>
      
      {/* Background Atmosphere */}
      <div className={`absolute inset-0 rounded-full bg-[rgba(var(--accent),0.03)] blur-[150px] transition-all duration-1000 ${isSpeaking ? 'opacity-100 scale-150' : isProcessing ? 'opacity-60 scale-110' : 'opacity-20'}`}></div>

      {/* Primary Synaptic Mesh */}
      <svg className={`absolute inset-0 w-full h-full opacity-30 ${isProcessing ? 'animate-spin-slower' : 'animate-spin-super-slow'}`} viewBox="0 0 100 100" style={{ filter: 'url(#hologram-glow)' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {webElements.lines.map((l, i) => (
          <line 
            key={i} 
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} 
            stroke="url(#lineGrad)" 
            strokeWidth="0.04" 
            strokeOpacity={l.opacity * (isSpeaking ? 2.5 : isProcessing ? 1.5 : 1)} 
            className="transition-opacity duration-500"
          />
        ))}
      </svg>

      {/* Tactical Orbital HUD */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`absolute w-[80%] h-[80%] border border-[rgba(var(--accent),0.1)] rounded-full ${isProcessing ? 'animate-spin-slow' : 'opacity-10'}`}></div>
        <div className={`absolute w-[70%] h-[70%] border border-dashed border-[rgba(var(--accent),0.05)] rounded-full ${isProcessing ? 'animate-reverse-spin-slow' : 'opacity-5'}`}></div>
        
        {/* Cardinal Markers */}
        {[0, 90, 180, 270].map((deg) => (
          <div 
            key={deg} 
            className="absolute w-1 h-6 accent-bg opacity-40" 
            style={{ transform: `rotate(${deg}deg) translateY(-210px)` }}
          ></div>
        ))}
      </div>
      
      {/* Core Projection Unit */}
      <div className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
        <div className={`absolute inset-0 bg-gradient-to-tr from-[rgba(var(--accent),0.4)] via-transparent to-[rgba(var(--accent),0.2)] rounded-full blur-[80px] animate-pulse`}></div>
        
        {/* Central Iris */}
        <div className={`relative w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-[#050201] border-2 border-[rgba(var(--accent),0.5)] flex items-center justify-center shadow-[0_0_150px_rgba(var(--accent),0.4)] transition-all duration-700 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-16 h-16 sm:w-24 sm:h-24 rounded-full accent-bg shadow-[0_0_80px_rgba(var(--accent),1)] transition-all duration-300 ${isSpeaking ? 'scale-125 brightness-150' : ''}`}></div>
          
          {/* Inner Mech-Rings */}
          <div className="absolute inset-4 border border-[rgba(var(--accent),0.2)] rounded-full animate-spin" style={{ animationDuration: '4s' }}></div>
          <div className="absolute inset-8 border border-dashed border-[rgba(var(--accent),0.3)] rounded-full animate-reverse-spin" style={{ animationDuration: '12s' }}></div>

          {/* Voice Modulation Spectrum */}
          {[...Array(48)].map((_, i) => (
            <div 
              key={i}
              className={`absolute w-[1.5px] bg-gradient-to-t from-[rgb(var(--accent))] to-transparent transition-all duration-150 origin-bottom`}
              style={{ 
                height: isSpeaking ? `${30 + Math.random() * 60}px` : isProcessing ? '20px' : '10px',
                bottom: '50%',
                transform: `rotate(${i * 7.5}deg) translateY(-45px)`,
                opacity: isSpeaking ? 1 : 0.1
              }}
            ></div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin-super-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-super-slow { animation: spin-super-slow 180s linear infinite; }
        
        @keyframes spin-slower { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slower { animation: spin-slower 60s linear infinite; }

        @keyframes reverse-spin-slow { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-reverse-spin-slow { animation: reverse-spin-slow 30s linear infinite; }
        
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 15s linear infinite; }
      `}</style>
    </div>
  );
};
